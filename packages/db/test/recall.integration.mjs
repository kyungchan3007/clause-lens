// 분석 기록 재열람 — 실 Postgres 보관 설정·목록 집계 검증 (TASK-008 / #96, 0030).
// 오프라인 게이트(checks.sh) 밖. 로컬 Postgres 필요:
//   docker compose up -d postgres
//   DATABASE_URL="postgresql://clauselens:clauselens@localhost:5432/clauselens" \
//     pnpm --filter @clause-lens/db exec prisma migrate deploy
//   DATABASE_URL=... node packages/db/test/recall.integration.mjs
// 설계: agents/intent/specs/0030-recall-documents-list/
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../generated/client/index.js";
import {
  confirmAnalysisResultTx,
  confirmPageAnalysisTx,
  listRecentDocuments,
  RETENTION_DAYS,
} from "../analysis/index.js";

const prisma = new PrismaClient();
const RUN = randomUUID().slice(0, 8);
const createdUserIds = [];

async function seedUser() {
  const id = `rc-${RUN}-${randomUUID().slice(0, 8)}`;
  await prisma.user.create({ data: { id, provider: "KAKAO", providerUserId: id } });
  createdUserIds.push(id);
  return id;
}

// uploaded 문서 + 페이지 N개(revision 1) + queued job + PageAnalysis(pending) 시드.
async function seedAnalyzable(userId, pageCount) {
  const doc = await prisma.document.create({
    data: {
      userId,
      clientRequestId: randomUUID(),
      status: "uploaded",
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  const pages = [];
  for (let i = 0; i < pageCount; i++) {
    const p = await prisma.page.create({
      data: {
        documentId: doc.id,
        order: i,
        revision: 1,
        contentType: "image/jpeg",
        expectedSize: 1000,
        status: "uploaded",
      },
    });
    pages.push(p);
  }
  const job = await prisma.analysisJob.create({
    data: { documentId: doc.id, status: "queued", totalPages: pageCount },
  });
  for (const p of pages) {
    await prisma.pageAnalysis.create({
      data: { jobId: job.id, pageId: p.id, revision: 1, status: "pending" },
    });
  }
  return { documentId: doc.id, jobId: job.id, pages };
}

function clause(order, riskLevel) {
  return {
    order,
    type: "other",
    title: `c${order}`,
    description: "d",
    riskLevel,
    sourceText: "s",
    boxes: [{ x: 0, y: 0, width: 1, height: 1 }],
  };
}

async function confirmPageDone(jobId, pageId, clauses) {
  return confirmAnalysisResultTx(prisma, {
    jobId,
    input: {
      pageId,
      revision: 1,
      model: "test",
      promptVersion: "v1",
      schemaVersion: "v1",
      clauses,
    },
  });
}

async function run() {
  // ── 1) done 확정 시 completedAt·retainUntil 1회 설정 + 집계 ──
  const u = await seedUser();
  const a = await seedAnalyzable(u, 2);
  await confirmPageDone(a.jobId, a.pages[0].id, [clause(0, "high"), clause(1, "medium")]);
  const res = await confirmPageDone(a.jobId, a.pages[1].id, [clause(0, "high")]);
  assert.equal(res.jobStatus, "done", "두 페이지 done → job done");

  const doc1 = await prisma.document.findUnique({ where: { id: a.documentId } });
  assert.equal(doc1.status, "done");
  assert.ok(doc1.completedAt, "completedAt 설정됨");
  assert.ok(doc1.retainUntil, "retainUntil 설정됨");
  const span = doc1.retainUntil.getTime() - doc1.completedAt.getTime();
  const expected = RETENTION_DAYS * 24 * 3600_000;
  assert.ok(Math.abs(span - expected) < 2000, `retainUntil = completedAt + ${RETENTION_DAYS}일`);

  // 멱등 재확인이 기한을 연장하지 않음(completedAt IS NULL 가드).
  const before = doc1.retainUntil.getTime();
  await confirmPageDone(a.jobId, a.pages[0].id, [clause(0, "low")]); // terminal → no-op
  const doc1b = await prisma.document.findUnique({ where: { id: a.documentId } });
  assert.equal(doc1b.retainUntil.getTime(), before, "중복 완료가 retainUntil을 연장하지 않음");

  // ── 2) 목록 집계: 공개 결과 조항만, risk/페이지 수 ──
  const page = await listRecentDocuments(prisma, u, {});
  assert.equal(page.items.length, 1, "문서 1건");
  const item = page.items[0];
  assert.equal(item.documentId, a.documentId);
  assert.equal(item.status, "done");
  assert.equal(item.totalPageCount, 2);
  assert.equal(item.analyzedPageCount, 2);
  assert.deepEqual(item.risk, { high: 2, medium: 1, low: 0 }, "high2 medium1 (중복 revision 없음)");

  // ── 3) partial(1 done + 1 failed) 포함, analyzed<total ──
  const u2 = await seedUser();
  const b = await seedAnalyzable(u2, 2);
  await confirmPageDone(b.jobId, b.pages[0].id, [clause(0, "low")]);
  const pr = await confirmPageAnalysisTx(prisma, {
    jobId: b.jobId,
    outcome: { pageId: b.pages[1].id, ok: false, errorCode: "ocr_failed", retryable: false },
  });
  assert.equal(pr.jobStatus, "partial");
  const pageB = await listRecentDocuments(prisma, u2, {});
  assert.equal(pageB.items.length, 1);
  assert.equal(pageB.items[0].status, "partial");
  assert.equal(pageB.items[0].totalPageCount, 2);
  assert.equal(pageB.items[0].analyzedPageCount, 1, "done 페이지만 analyzed");
  assert.deepEqual(pageB.items[0].risk, { high: 0, medium: 0, low: 1 });

  // ── 4) 소유자 격리 + 완료순 정렬 + 커서 페이지네이션 ──
  const u3 = await seedUser();
  const docIds = [];
  for (let i = 0; i < 3; i++) {
    const s = await seedAnalyzable(u3, 1);
    await confirmPageDone(s.jobId, s.pages[0].id, [clause(0, "high")]);
    docIds.push(s.documentId);
    await new Promise((r) => setTimeout(r, 15)); // completedAt 간격 확보
  }
  const all = await listRecentDocuments(prisma, u3, {});
  assert.equal(all.items.length, 3, "u3 문서 3건만(타 사용자 제외)");
  // 완료순 DESC = 마지막 생성이 먼저.
  assert.deepEqual(
    all.items.map((x) => x.documentId),
    [docIds[2], docIds[1], docIds[0]],
    "completedAt DESC 정렬",
  );

  // 커서: limit 2 → hasMore, 다음 페이지 1건, 중복 없음.
  const p1 = await listRecentDocuments(prisma, u3, { limit: 2 });
  assert.equal(p1.items.length, 2);
  assert.equal(p1.hasMore, true);
  const last = p1.items[p1.items.length - 1];
  const p2 = await listRecentDocuments(prisma, u3, {
    limit: 2,
    before: { completedAt: last.completedAt, id: last.documentId },
  });
  assert.equal(p2.items.length, 1, "다음 페이지 1건");
  assert.equal(p2.hasMore, false);
  const ids1 = new Set(p1.items.map((x) => x.documentId));
  assert.ok(!ids1.has(p2.items[0].documentId), "페이지 간 중복 없음");

  // ── 5) 보관 만료 문서는 목록에서 제외 ──
  const u4 = await seedUser();
  const e = await seedAnalyzable(u4, 1);
  await confirmPageDone(e.jobId, e.pages[0].id, [clause(0, "high")]);
  await prisma.document.update({
    where: { id: e.documentId },
    data: { retainUntil: new Date(Date.now() - 1000) },
  });
  const expiredList = await listRecentDocuments(prisma, u4, {});
  assert.equal(expiredList.items.length, 0, "retainUntil 지난 문서 제외");

  console.log("✅ recall.integration: 모든 단언 통과");
}

run()
  .catch((e) => {
    console.error("❌ recall.integration 실패:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    // 정리: 생성한 사용자 연쇄 삭제(FK onDelete: Cascade).
    for (const id of createdUserIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });
