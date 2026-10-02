import { PrismaClient, Prisma } from "../generated/client";
import {
  canSaveDocuments,
  monthWindowStart,
  subscriptionQuotaRemaining,
  SUBSCRIPTION_MONTHLY_QUOTA,
  type SubscriptionLike,
} from "./subscription-ops";

// 무료 분석 횟수 집행 — api·worker 공유 도메인 전이 계약.
// 설계: agents/intent/specs/0027-entitlement-enforcement/
// 정책(#79): done만 1회 차감 · partial/failed/invalid 무차감 · 멱등키 AnalysisJob.id · 사용자당 3회.
// 흐름: 접수 시 예약(reserve) → terminal에서 done=확정(consume) / 그 외=해제(release).

export const FREE_GRANTED_DEFAULT = 3;

export interface EntitlementView {
  freeGranted: number;
  freeConsumed: number;
  freeReserved: number;
  freeRemaining: number;
}

type AnyClient = PrismaClient | Prisma.TransactionClient;

function toView(e: {
  freeGranted: number;
  freeConsumed: number;
  freeReserved: number;
}): EntitlementView {
  return {
    freeGranted: e.freeGranted,
    freeConsumed: e.freeConsumed,
    freeReserved: e.freeReserved,
    freeRemaining: Math.max(0, e.freeGranted - e.freeConsumed - e.freeReserved),
  };
}

// 자격 행 보장(없으면 기본 부여). 조회·예약 공용. 기존 행은 건드리지 않음.
export async function ensureEntitlement(tx: AnyClient, userId: string): Promise<void> {
  await tx.entitlement.upsert({
    where: { userId },
    create: { userId, freeGranted: FREE_GRANTED_DEFAULT },
    update: {},
  });
}

// 현재 자격(없으면 기본 부여 후) 조회 — 잔량 표시용 서버 값.
export async function getEntitlement(
  prisma: PrismaClient,
  userId: string,
): Promise<EntitlementView> {
  await ensureEntitlement(prisma, userId);
  const e = await prisma.entitlement.findUniqueOrThrow({ where: { userId } });
  return toView(e);
}

/**
 * 무료 1회 원자 예약(한도 집행). 새 job 생성 트랜잭션 안에서 호출.
 * - 같은 jobId charge가 이미 있으면 멱등 통과(true).
 * - 가용(freeGranted-freeConsumed-freeReserved>=1)이면 freeReserved++ & charge(reserved) 생성 → true.
 * - 가용 없으면 false(호출측이 거부로 매핑).
 * 계산식 조건은 updateMany where로 표현 불가 → 조건부 raw UPDATE로 초과 예약을 막는다(실측: 가용1·동시8→1건).
 * (READ COMMITTED에서 대기 UPDATE가 갱신 행에 조건 재평가 → false. 더 높은 격리수준에선 직렬화 실패로 나타날 수 있음.)
 */
export async function reserveFreeAnalysis(
  tx: Prisma.TransactionClient,
  userId: string,
  jobId: string,
): Promise<boolean> {
  const existing = await tx.entitlementCharge.findUnique({ where: { jobId } });
  if (existing) return true; // 멱등 — 이미 이 job에 대해 예약됨

  await ensureEntitlement(tx, userId);
  const affected = await tx.$executeRaw`
    UPDATE "Entitlement"
       SET "freeReserved" = "freeReserved" + 1, "updatedAt" = now()
     WHERE "userId" = ${userId}
       AND "freeGranted" - "freeConsumed" - "freeReserved" >= 1`;
  if (affected === 0) return false; // 가용 없음

  await tx.entitlementCharge.create({ data: { jobId, userId, status: "reserved" } });
  return true;
}

/**
 * terminal 정산: done=확정 차감(consume), 그 외=예약 해제(release). terminal 전이와 같은 tx.
 * 멱등: `reserved→target` 전이를 **원자적 조건부 UPDATE**로 단 한 호출만 획득(RETURNING 행이 있을 때만 카운터 변경).
 * findUnique+update로 나누면 READ COMMITTED 동시 호출이 둘 다 reserved를 읽어 이중 차감(실측 consumed=2) → 금지.
 * 현실 경로(reaggregate Serializable + job-terminal 가드)와 무관하게 함수 자체가 격리수준·호출자에 안전.
 */
export async function settleFreeAnalysis(
  tx: Prisma.TransactionClient,
  jobId: string,
  outcome: "done" | "partial" | "failed",
): Promise<void> {
  const target = outcome === "done" ? "consumed" : "released";
  // 정산 권한을 원자적으로 획득: reserved인 charge만 전이. 반환 행이 없으면 이미 정산됨/예약 없음 → no-op.
  const rows = await tx.$queryRaw<{ userId: string }[]>`
    UPDATE "EntitlementCharge"
       SET status = ${target}::"EntitlementChargeStatus", "settledAt" = now()
     WHERE "jobId" = ${jobId} AND status = 'reserved'
    RETURNING "userId"`;
  if (rows.length === 0) return; // 멱등 no-op

  const { userId } = rows[0];
  await tx.entitlement.update({
    where: { userId },
    data:
      outcome === "done"
        ? { freeReserved: { decrement: 1 }, freeConsumed: { increment: 1 } }
        : { freeReserved: { decrement: 1 } },
  });
}

// ── 구독 연동(TASK-006 #162): 접수 근거(FREE|SUBSCRIPTION) 원장 + 권한 조회 ──

const ACTIVE_SUB_STATUSES = ["active", "grace"] as const;

// 유효 구독 조회(판정용 최소 필드).
async function loadActiveSubs(tx: AnyClient, userId: string): Promise<SubscriptionLike[]> {
  const rows = await tx.subscription.findMany({
    where: { userId, status: { in: [...ACTIVE_SUB_STATUSES] } },
    select: { status: true, currentPeriodEnd: true },
  });
  return rows as SubscriptionLike[];
}

// 이번 달(캘린더월) 구독 분석 사용량 = source=SUBSCRIPTION·window 내 reserved|consumed charge 수.
async function countSubscriptionUsage(
  tx: AnyClient,
  userId: string,
  now: Date,
): Promise<number> {
  return tx.entitlementCharge.count({
    where: {
      userId,
      source: "SUBSCRIPTION",
      status: { in: ["reserved", "consumed"] },
      createdAt: { gte: monthWindowStart(now) },
    },
  });
}

/**
 * 분석 1회 접수 예약 — 근거(source) 선택(ADR-12). 새 job 생성 트랜잭션 안에서 호출.
 * - 같은 jobId charge 있으면 멱등 통과(true).
 * - 유효 구독 + 월 쿼터 잔여 → charge(reserved, SUBSCRIPTION) 생성(무료 카운터 불변), true.
 * - 아니면 무료 폴백(reserveFreeAnalysis, source 기본 FREE).
 * - 둘 다 없으면 false(quota 거부).
 * 접수 근거는 여기서 고정 — 실행 중 구독 만료돼도 바뀌지 않는다(settleAnalysis가 근거대로 정산).
 */
export async function reserveAnalysis(
  tx: Prisma.TransactionClient,
  userId: string,
  jobId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const existing = await tx.entitlementCharge.findUnique({ where: { jobId } });
  if (existing) return true; // 멱등

  const subs = await loadActiveSubs(tx, userId);
  if (canSaveDocuments(subs, now)) {
    const used = await countSubscriptionUsage(tx, userId, now);
    if (subscriptionQuotaRemaining(used) > 0) {
      // 구독 월 쿼터 선점(소프트 한도 — 고동시성에서 수건 초과 가능, R1). 무료 카운터는 건드리지 않는다.
      await tx.entitlementCharge.create({
        data: { jobId, userId, status: "reserved", source: "SUBSCRIPTION" },
      });
      return true;
    }
    // 월 쿼터 소진 → 무료 폴백
  }
  return reserveFreeAnalysis(tx, userId, jobId); // source 기본 FREE
}

/**
 * terminal 정산 — charge.source로 라우팅. terminal 전이와 같은 tx.
 * - FREE: 기존 settleFreeAnalysis(done=확정 차감 카운터, 그 외 해제).
 * - SUBSCRIPTION: charge status만 원자적 전이(done=consumed, 그 외=released). 무료 카운터 불변(쿼터=행 수).
 * 멱등: 각 경로가 status=='reserved'일 때만 전이.
 */
export async function settleAnalysis(
  tx: Prisma.TransactionClient,
  jobId: string,
  outcome: "done" | "partial" | "failed",
): Promise<void> {
  const charge = await tx.entitlementCharge.findUnique({
    where: { jobId },
    select: { source: true },
  });
  if (!charge) return; // 예약 없음 — no-op
  if (charge.source === "FREE") {
    await settleFreeAnalysis(tx, jobId, outcome);
    return;
  }
  // SUBSCRIPTION: 카운터 없이 charge 상태만 전이(멱등: reserved만).
  const target = outcome === "done" ? "consumed" : "released";
  await tx.entitlementCharge.updateMany({
    where: { jobId, status: "reserved" },
    data: { status: target, settledAt: new Date() },
  });
}

export interface AnalysisAccessView {
  storage: { canSave: boolean };
  analysis: { source: "free" | "subscription"; remaining: number; monthlyQuota: number };
}

// 권한 조회 — 보관 가능 여부 + 분석 잔여(구독이면 월 쿼터, 아니면 무료). 서버가 진실.
export async function getAnalysisAccess(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<AnalysisAccessView> {
  const subs = await loadActiveSubs(prisma, userId);
  const canSave = canSaveDocuments(subs, now);
  if (canSave) {
    const used = await countSubscriptionUsage(prisma, userId, now);
    return {
      storage: { canSave: true },
      analysis: {
        source: "subscription",
        remaining: subscriptionQuotaRemaining(used),
        monthlyQuota: SUBSCRIPTION_MONTHLY_QUOTA,
      },
    };
  }
  const ent = await getEntitlement(prisma, userId);
  return {
    storage: { canSave: false },
    analysis: { source: "free", remaining: ent.freeRemaining, monthlyQuota: ent.freeGranted },
  };
}
