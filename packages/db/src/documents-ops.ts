import type { ClauseRisk } from "./analysis-ops";
import { PrismaClient, Prisma } from "../generated/client";

// 분석 기록 재열람 — 문서 목록 일괄 조회(0030). api가 GET /me/documents에서 사용.
// 규칙(Codex 설계):
//  - 소유자 + 공개 결과(done|partial) + retainUntil>now 만 노출(접근 차단 = 재열람 종료).
//  - 완료순(completedAt DESC, id DESC) 안정 커서. 매 호출 소유자·보관·상태 재적용.
//  - 집계는 **공개 결과(문서당 최신 job)의 done 페이지 조항**만 대상(N+1 없이 일괄).

export type RecentDocumentStatus = "done" | "partial";
export type RetentionStateValue = "TEMPORARY" | "SAVED";

export interface RecentDocumentRow {
  documentId: string;
  completedAt: Date;
  retainUntil: Date;
  status: RecentDocumentStatus;
  retentionState: RetentionStateValue; // 보관 수명(#163) — SAVED는 retainUntil 경과해도 노출
  savedAt: Date | null; // SAVED 전환 시각(감사용)
  totalPageCount: number; // 문서 전체 페이지 수
  analyzedPageCount: number; // 공개 결과에서 분석 완료(done)된 페이지 수(partial 구분용)
  risk: { high: number; medium: number; low: number }; // 공개 결과 조항의 riskLevel별 개수
}

export interface RecentDocumentsPage {
  items: RecentDocumentRow[];
  hasMore: boolean; // 다음 페이지 존재 여부(커서 발급 판단은 호출측)
}

export interface RecentDocumentsCursor {
  completedAt: Date;
  id: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

// 재열람 가능한 최근 분석 문서 1페이지 + 일괄 집계.
export async function listRecentDocuments(
  prisma: PrismaClient,
  userId: string,
  opts: { limit?: number; before?: RecentDocumentsCursor } = {},
): Promise<RecentDocumentsPage> {
  const limit = clampLimit(opts.limit);

  // ① 문서 페이지 선정(완료순, 커서 이후). limit+1로 다음 페이지 유무 판정.
  // (completedAt, id) 튜플 비교로 동률에서도 안정적인 커서.
  // 보관 가시성(#163): SAVED는 retainUntil 경과해도 노출, TEMPORARY는 retainUntil>now(DB 시계).
  // documentVisible()와 동치(여기에 목록 전용 status·retainUntil NOT NULL 제약 추가) — parity 테스트로 고정.
  const cursorCond = opts.before
    ? Prisma.sql`AND ("completedAt", "id") < (${opts.before.completedAt}, ${opts.before.id})`
    : Prisma.empty;
  const docs = await prisma.$queryRaw<
    {
      id: string;
      completedAt: Date;
      retainUntil: Date;
      status: RecentDocumentStatus;
      retentionState: RetentionStateValue;
      savedAt: Date | null;
    }[]
  >`
    SELECT "id", "completedAt", "retainUntil", "status", "retentionState", "savedAt"
    FROM "Document"
    WHERE "userId" = ${userId}
      AND "status" IN ('done', 'partial')
      AND "retentionState" <> 'DELETING'
      AND (
        "retentionState" = 'SAVED'
        OR ("retainUntil" IS NOT NULL AND "retainUntil" > now())
      )
      ${cursorCond}
    ORDER BY "completedAt" DESC, "id" DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;
  if (pageDocs.length === 0) return { items: [], hasMore: false };

  const docIds = pageDocs.map((d) => d.id);

  // ② 문서별 공개 결과 job = 최신 job(현재 문서당 1 job 보장; 재분석=TASK-007).
  const jobRows = await prisma.$queryRaw<{ id: string; documentId: string }[]>`
    SELECT DISTINCT ON ("documentId") "id", "documentId"
    FROM "AnalysisJob"
    WHERE "documentId" IN (${Prisma.join(docIds)})
    ORDER BY "documentId", "createdAt" DESC
  `;
  const jobByDoc = new Map(jobRows.map((j) => [j.documentId, j.id]));
  const jobIds = jobRows.map((j) => j.id);

  // ③ 일괄 집계(N+1 금지).
  const totalPages = await prisma.page.groupBy({
    by: ["documentId"],
    where: { documentId: { in: docIds } },
    _count: { _all: true },
  });
  const totalByDoc = new Map(totalPages.map((p) => [p.documentId, p._count._all]));

  const analyzedByJob = new Map<string, number>();
  const riskByJob = new Map<string, { high: number; medium: number; low: number }>();
  if (jobIds.length > 0) {
    const analyzed = await prisma.pageAnalysis.groupBy({
      by: ["jobId"],
      where: { jobId: { in: jobIds }, status: "done" },
      _count: { _all: true },
    });
    for (const a of analyzed) analyzedByJob.set(a.jobId, a._count._all);

    // 위험 집계: 공개 결과(done 페이지)의 (pageId, revision)에 귀속된 Clause만 — 다른 revision/실패 제외.
    const risks = await prisma.$queryRaw<
      { jobId: string; riskLevel: ClauseRisk; cnt: bigint }[]
    >`
      SELECT pa."jobId" AS "jobId", c."riskLevel" AS "riskLevel", count(*) AS "cnt"
      FROM "PageAnalysis" pa
      JOIN "Clause" c ON c."pageId" = pa."pageId" AND c."revision" = pa."revision"
      WHERE pa."jobId" IN (${Prisma.join(jobIds)}) AND pa."status" = 'done'
      GROUP BY pa."jobId", c."riskLevel"
    `;
    for (const r of risks) {
      const bucket = riskByJob.get(r.jobId) ?? { high: 0, medium: 0, low: 0 };
      bucket[r.riskLevel] = Number(r.cnt);
      riskByJob.set(r.jobId, bucket);
    }
  }

  const items: RecentDocumentRow[] = pageDocs.map((d) => {
    const jobId = jobByDoc.get(d.id);
    const risk = (jobId && riskByJob.get(jobId)) || { high: 0, medium: 0, low: 0 };
    return {
      documentId: d.id,
      completedAt: d.completedAt,
      retainUntil: d.retainUntil,
      status: d.status,
      retentionState: d.retentionState,
      savedAt: d.savedAt,
      totalPageCount: totalByDoc.get(d.id) ?? 0,
      analyzedPageCount: (jobId && analyzedByJob.get(jobId)) || 0,
      risk,
    };
  });

  return { items, hasMore };
}

// 재열람 보관 유효성(접근 차단 판정, 0030). retainUntil 미설정(진행중)=통과, 설정+과거=차단.
// 소유권은 호출측(findOwnedSession)에서 별도 확인.
export function isRetentionActive(retainUntil: Date | null | undefined, now = new Date()): boolean {
  if (retainUntil == null) return true; // 아직 terminal 아님(진행중) → 세션 접근으로 통과
  return retainUntil.getTime() > now.getTime();
}

// 공유 보관 가시성 판정(#163) — 상세(410)·목록·저장이 모두 이 함수를 공유한다.
// SAVED는 retainUntil 경과해도 노출(구독 유예·취소는 #164 권한, 게이트는 구독 재확인 안 함).
// 알 수 없는 상태(미래 DELETING 등)는 default-deny → #164가 DELETING 추가해도 전방 안전.
// 소유권은 호출측(findOwnedSession)에서 별도 확인.
export function documentVisible(
  doc: { retentionState: string; retainUntil: Date | null | undefined },
  now = new Date(),
): boolean {
  switch (doc.retentionState) {
    case "SAVED":
      return true;
    case "TEMPORARY":
      return isRetentionActive(doc.retainUntil, now);
    default:
      return false;
  }
}

// 저장(TEMPORARY→SAVED) 선검증(순수, 에러코드 산출용). 실제 전환은 조건부 UPDATE(CAS)가 단일 권위.
// 소유권·구독 보관 권한(canSaveDocuments)은 호출측에서 별도 확인.
export function canTransitionToSaved(
  doc: { status: string; retentionState: string; retainUntil: Date | null | undefined },
  now = new Date(),
): boolean {
  if (doc.status !== "done" && doc.status !== "partial") return false; // 미완료
  if (doc.retentionState !== "TEMPORARY") return false; // 이미 SAVED 등
  if (doc.retainUntil == null) return false; // terminal이면 항상 세팅(불변식) — 방어적 거부
  return isRetentionActive(doc.retainUntil, now); // 만료 후 신규 저장 불가
}
