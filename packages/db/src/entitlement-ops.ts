import { PrismaClient, Prisma } from "../generated/client";

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
 * 계산식 조건은 updateMany where로 표현 불가 → 조건부 raw UPDATE(원자, 격리수준 무관).
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
 * charge가 reserved일 때만 작동 → 중복 완료 이벤트·재연결에 no-op(멱등).
 */
export async function settleFreeAnalysis(
  tx: Prisma.TransactionClient,
  jobId: string,
  outcome: "done" | "partial" | "failed",
): Promise<void> {
  const charge = await tx.entitlementCharge.findUnique({ where: { jobId } });
  if (!charge || charge.status !== "reserved") return; // 멱등 가드

  if (outcome === "done") {
    await tx.entitlement.update({
      where: { userId: charge.userId },
      data: { freeReserved: { decrement: 1 }, freeConsumed: { increment: 1 } },
    });
    await tx.entitlementCharge.update({
      where: { jobId },
      data: { status: "consumed", settledAt: new Date() },
    });
  } else {
    await tx.entitlement.update({
      where: { userId: charge.userId },
      data: { freeReserved: { decrement: 1 } },
    });
    await tx.entitlementCharge.update({
      where: { jobId },
      data: { status: "released", settledAt: new Date() },
    });
  }
}
