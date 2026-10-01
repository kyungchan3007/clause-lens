// 무료 횟수 집행 — 실 Postgres 동시성·멱등 통합 검증 (TASK-005 / #90).
// 오프라인 게이트(checks.sh) 밖. 로컬 Postgres 필요:
//   docker compose up -d postgres
//   DATABASE_URL="postgresql://clauselens:clauselens@localhost:5432/clauselens" \
//     pnpm --filter @clause-lens/db exec prisma migrate deploy
//   DATABASE_URL=... node packages/db/test/entitlement.integration.mjs
// 설계: agents/intent/specs/0027-entitlement-enforcement/
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../generated/client/index.js";
import {
  reserveFreeAnalysis,
  settleFreeAnalysis,
} from "../analysis/entitlement-ops.js";

const prisma = new PrismaClient();
const RUN = randomUUID().slice(0, 8);
const createdUserIds = [];

// userId FK·document FK를 만족하는 최소 시드. granted를 직접 지정해 한도 경계 테스트.
async function seedUser(granted) {
  const id = `it-${RUN}-${randomUUID().slice(0, 8)}`;
  await prisma.user.create({
    data: { id, provider: "KAKAO", providerUserId: id },
  });
  await prisma.entitlement.create({
    data: { userId: id, freeGranted: granted },
  });
  createdUserIds.push(id);
  return id;
}

async function seedDoc(userId) {
  const doc = await prisma.document.create({
    data: {
      userId,
      clientRequestId: randomUUID(),
      status: "uploaded",
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return doc.id;
}

// 활성 job 부분 유니크 인덱스 때문에 job마다 별도 document.
async function seedJob(userId) {
  const documentId = await seedDoc(userId);
  const job = await prisma.analysisJob.create({
    data: { documentId, status: "queued", totalPages: 1 },
  });
  return job.id;
}

// createAnalysisJob의 핵심(문서 잠금 + 기존 job 재확인 + 예약)을 그대로 재현 — Fix 2 검증용.
async function acquireOrReserve(userId, documentId) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Document" WHERE "id" = ${documentId} FOR UPDATE`;
    const existing = await tx.analysisJob.findFirst({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { jobId: existing.id, created: false };
    const job = await tx.analysisJob.create({
      data: { documentId, status: "queued", totalPages: 1 },
    });
    const ok = await reserveFreeAnalysis(tx, userId, job.id);
    if (!ok) throw new Error("quota");
    return { jobId: job.id, created: true };
  });
}

async function viewOf(userId) {
  return prisma.entitlement.findUniqueOrThrow({ where: { userId } });
}
const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "  ✅" : "  ❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function t1_concurrentReserveNoOvershoot() {
  const N = 8;
  const userId = await seedUser(1); // 가용 1
  const jobIds = [];
  for (let i = 0; i < N; i++) jobIds.push(await seedJob(userId));
  // 동시 예약 N건 (각자 트랜잭션) — 실 Postgres 행 잠금으로 직렬화
  const outcomes = await Promise.all(
    jobIds.map((jobId) =>
      prisma.$transaction((tx) => reserveFreeAnalysis(tx, userId, jobId)),
    ),
  );
  const granted = outcomes.filter(Boolean).length;
  const ent = await viewOf(userId);
  const charges = await prisma.entitlementCharge.count({ where: { userId, status: "reserved" } });
  check("T1 동시 예약 N=8·가용1 → 정확히 1건만 성공", granted === 1, `성공 ${granted}건`);
  check("T1 freeReserved == 1 (초과 예약 없음)", ent.freeReserved === 1, `reserved=${ent.freeReserved}`);
  check("T1 reserved charge == 1", charges === 1, `charges=${charges}`);
}

async function t2_settleDoneIdempotent() {
  const userId = await seedUser(3);
  const jobId = await seedJob(userId);
  await prisma.$transaction((tx) => reserveFreeAnalysis(tx, userId, jobId));
  // 중복 완료 이벤트(순차) — 두 번째는 no-op
  await prisma.$transaction((tx) => settleFreeAnalysis(tx, jobId, "done"));
  await prisma.$transaction((tx) => settleFreeAnalysis(tx, jobId, "done"));
  const ent = await viewOf(userId);
  const charge = await prisma.entitlementCharge.findUniqueOrThrow({ where: { jobId } });
  check("T2 done 중복 정산 → consumed 정확히 1", ent.freeConsumed === 1 && ent.freeReserved === 0, `consumed=${ent.freeConsumed} reserved=${ent.freeReserved}`);
  check("T2 charge == consumed", charge.status === "consumed", charge.status);
}

async function t3_releaseOnFailed() {
  const userId = await seedUser(1);
  const jobId = await seedJob(userId);
  await prisma.$transaction((tx) => reserveFreeAnalysis(tx, userId, jobId));
  await prisma.$transaction((tx) => settleFreeAnalysis(tx, jobId, "failed"));
  const ent = await viewOf(userId);
  const charge = await prisma.entitlementCharge.findUniqueOrThrow({ where: { jobId } });
  check("T3 failed 종결 → 무차감·예약 해제", ent.freeConsumed === 0 && ent.freeReserved === 0, `consumed=${ent.freeConsumed} reserved=${ent.freeReserved}`);
  check("T3 charge == released", charge.status === "released", charge.status);
}

async function t4_reserveRollbackNoLeak() {
  const userId = await seedUser(3);
  const jobId = await seedJob(userId);
  // 예약 성공 후 tx를 강제로 롤백 → 예약·charge가 영속되면 안 됨
  await prisma
    .$transaction(async (tx) => {
      const ok = await reserveFreeAnalysis(tx, userId, jobId);
      assert.equal(ok, true);
      throw new Error("forced-rollback");
    })
    .catch((e) => {
      if (e.message !== "forced-rollback") throw e;
    });
  const ent = await viewOf(userId);
  const charge = await prisma.entitlementCharge.findUnique({ where: { jobId } });
  check("T4 예약 tx 롤백 → freeReserved 누수 없음", ent.freeReserved === 0, `reserved=${ent.freeReserved}`);
  check("T4 예약 tx 롤백 → charge 없음", charge === null, `charge=${charge ? charge.status : "null"}`);
}

async function t5_reserveIdempotentSameJob() {
  const userId = await seedUser(3);
  const jobId = await seedJob(userId);
  await prisma.$transaction((tx) => reserveFreeAnalysis(tx, userId, jobId));
  await prisma.$transaction((tx) => reserveFreeAnalysis(tx, userId, jobId)); // 같은 job 재예약
  const ent = await viewOf(userId);
  check("T5 같은 job 재예약 멱등 → reserved 1 (이중 예약 없음)", ent.freeReserved === 1, `reserved=${ent.freeReserved}`);
}

// Fix 1 검증: settle을 직접 동시 호출해도 원자적 조건부 전이로 정확히 1회만 차감(이전엔 consumed=2).
async function t6_concurrentSettleDoneAtomic() {
  const userId = await seedUser(3);
  const jobId = await seedJob(userId);
  await prisma.$transaction((tx) => reserveFreeAnalysis(tx, userId, jobId));
  await Promise.all([
    prisma.$transaction((tx) => settleFreeAnalysis(tx, jobId, "done")).catch(() => {}),
    prisma.$transaction((tx) => settleFreeAnalysis(tx, jobId, "done")).catch(() => {}),
  ]);
  const ent = await viewOf(userId);
  check("T6 settle 직접 동시호출 → 원자적, consumed 정확히 1 (이전 버그 consumed=2)", ent.freeConsumed === 1 && ent.freeReserved === 0, `consumed=${ent.freeConsumed} reserved=${ent.freeReserved}`);
}

// Fix 2 검증: 같은 문서 동시 접수(문서 잠금+재확인) → 정확히 1 job 생성·1 예약, 나머지는 기존 재사용(2차 차감 없음).
async function t7_docLockNoDoubleJob() {
  const N = 6;
  const userId = await seedUser(3);
  const documentId = await seedDoc(userId);
  const outcomes = await Promise.all(
    Array.from({ length: N }, () => acquireOrReserve(userId, documentId).catch((e) => ({ error: e.message }))),
  );
  const created = outcomes.filter((o) => o.created).length;
  const jobCount = await prisma.analysisJob.count({ where: { documentId } });
  const ent = await viewOf(userId);
  const charges = await prisma.entitlementCharge.count({ where: { userId } });
  check("T7 동시 접수 N=6 → job 생성 정확히 1 (문서당 1)", created === 1 && jobCount === 1, `created=${created} jobs=${jobCount}`);
  check("T7 2차 차감 없음 → reserved 1·charge 1", ent.freeReserved === 1 && charges === 1, `reserved=${ent.freeReserved} charges=${charges}`);
}

async function main() {
  try {
    await t1_concurrentReserveNoOvershoot();
    await t2_settleDoneIdempotent();
    await t3_releaseOnFailed();
    await t4_reserveRollbackNoLeak();
    await t5_reserveIdempotentSameJob();
    await t6_concurrentSettleDoneAtomic();
    await t7_docLockNoDoubleJob();
  } finally {
    // cascade: User 삭제 → Document·AnalysisJob·EntitlementCharge·Entitlement 정리
    for (const id of createdUserIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
