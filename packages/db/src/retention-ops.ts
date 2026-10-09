import { PrismaClient } from "../generated/client";

// 보관 만료 실삭제(#164) — 무료(TEMPORARY)만. SAVED(구독 만료)는 #165(lapsedAt·트랜잭션 내 재확인).
// 안전 지연: 410 차단 시점(retainUntil)과 분리해 LAG일 뒤에만 실삭제 대상(skew·오확정·지원 복구 여유).

export const RETENTION_DELETE_LAG_DAYS = 3;

export type HardDeleteReason = "free_expired";

// 무료 만료 실삭제 후보 판정(순수, 시계 주입). CAS·목록 쿼리의 SQL 술어와 동일 의미.
export function isTemporaryHardDeletable(
  doc: { retentionState: string; retainUntil: Date | null | undefined },
  now = new Date(),
  lagDays = RETENTION_DELETE_LAG_DAYS,
): boolean {
  if (doc.retentionState !== "TEMPORARY") return false;
  if (doc.retainUntil == null) return false; // terminal 아님(진행중)·draft/failed → 비대상
  return doc.retainUntil.getTime() + lagDays * 24 * 60 * 60 * 1000 <= now.getTime();
}

// 삭제 사유 태그(감사 로그·dry-run). 비대상이면 null.
export function deletionReason(
  doc: { retentionState: string; retainUntil: Date | null | undefined },
  now = new Date(),
  lagDays = RETENTION_DELETE_LAG_DAYS,
): HardDeleteReason | null {
  return isTemporaryHardDeletable(doc, now, lagDays) ? "free_expired" : null;
}

export interface HardDeleteCandidate {
  documentId: string;
  userId: string;
}

export interface DocumentKeysData {
  userId: string;
  pages: { pageId: string; finalKey: string | null; revision: number }[];
}

// 후보 수(중단 상한 판정용). DB now() 기준.
export async function countHardDeleteCandidates(
  prisma: PrismaClient,
  lagDays = RETENTION_DELETE_LAG_DAYS,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT count(*) AS "cnt"
    FROM "Document"
    WHERE "retentionState" = 'TEMPORARY'
      AND "retainUntil" IS NOT NULL
      AND "retainUntil" + make_interval(days => ${lagDays}) <= now()
  `;
  return Number(rows[0]?.cnt ?? 0n);
}

// 실삭제 후보 1배치(소유자 포함). DB now() 기준 — isTemporaryHardDeletable와 동일 술어.
export async function findHardDeleteCandidates(
  prisma: PrismaClient,
  limit: number,
  lagDays = RETENTION_DELETE_LAG_DAYS,
): Promise<HardDeleteCandidate[]> {
  return prisma.$queryRaw<HardDeleteCandidate[]>`
    SELECT "id" AS "documentId", "userId"
    FROM "Document"
    WHERE "retentionState" = 'TEMPORARY'
      AND "retainUntil" IS NOT NULL
      AND "retainUntil" + make_interval(days => ${lagDays}) <= now()
    ORDER BY "retainUntil" ASC
    LIMIT ${limit}
  `;
}

// TEMPORARY → DELETING 조건부 전환(CAS, 후보 술어 재검증). 1행이면 전환 성공, 0행이면 skip(변경됨).
// 비가역: DELETING에서 되돌리는 경로 없음. 저장 CAS는 retentionState='TEMPORARY' 가드라 부활 불가.
export async function transitionToDeleting(
  prisma: PrismaClient,
  documentId: string,
  lagDays = RETENTION_DELETE_LAG_DAYS,
): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "Document"
    SET "retentionState" = 'DELETING'
    WHERE "id" = ${documentId}
      AND "retentionState" = 'TEMPORARY'
      AND "retainUntil" IS NOT NULL
      AND "retainUntil" + make_interval(days => ${lagDays}) <= now()
  `;
  return updated === 1;
}

// 키 열거용 DB 데이터(userId + 페이지 finalKey·revision). 행 삭제 전에 읽어야 함(랜덤 finalKey는 DB에만).
export async function loadDocumentKeysData(
  prisma: PrismaClient,
  documentId: string,
): Promise<DocumentKeysData | null> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      userId: true,
      pages: { select: { id: true, finalKey: true, revision: true }, orderBy: { order: "asc" } },
    },
  });
  if (!doc) return null;
  return {
    userId: doc.userId,
    pages: doc.pages.map((p) => ({ pageId: p.id, finalKey: p.finalKey, revision: p.revision })),
  };
}

// 삭제 감사 기록(삭제 전). append-only.
export async function recordDeletionAudit(
  prisma: PrismaClient,
  entry: { documentId: string; userId: string; reason: HardDeleteReason; keys: string[]; pageCount: number },
): Promise<void> {
  await prisma.deletionAudit.create({
    data: {
      documentId: entry.documentId,
      userId: entry.userId,
      reason: entry.reason,
      keys: entry.keys,
      pageCount: entry.pageCount,
    },
  });
}

// Document 행 삭제(자식 cascade). S3 전 키 삭제 확인 후에만 호출.
export async function deleteDocumentRow(prisma: PrismaClient, documentId: string): Promise<void> {
  await prisma.document.delete({ where: { id: documentId } });
}
