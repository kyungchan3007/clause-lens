import type { DocumentListItem, DocumentListResponse } from "@clause-lens/contracts";
import type { RecentDocumentRow, RecentDocumentsCursor } from "@clause-lens/db/analysis";

// 재열람 문서 목록 DB 행 → API 계약 DTO(0030). 라벨 등 표현은 여기서.
// 서버가 쓴 값만 담으므로 안전(앱은 zod로 재검증).

// 불투명 커서: (completedAt, documentId) 튜플을 base64url JSON으로. 앱엔 불투명.
export function encodeCursor(row: RecentDocumentRow): string {
  const json = JSON.stringify({ c: row.completedAt.toISOString(), id: row.documentId });
  return Buffer.from(json, "utf8").toString("base64url");
}

// 잘못된 커서는 undefined(= 첫 페이지)로 간주(관대 파싱 — 500 대신 처음부터).
export function decodeCursor(cursor: string | undefined): RecentDocumentsCursor | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const completedAt = new Date(parsed.c);
    if (typeof parsed.id !== "string" || Number.isNaN(completedAt.getTime())) return undefined;
    return { completedAt, id: parsed.id };
  } catch {
    return undefined;
  }
}

function label(totalPageCount: number): string {
  return `계약서 · ${totalPageCount}장`;
}

export function toListItem(row: RecentDocumentRow): DocumentListItem {
  return {
    documentId: row.documentId,
    completedAt: row.completedAt.toISOString(),
    retainUntil: row.retainUntil.toISOString(),
    status: row.status,
    retentionState: row.retentionState,
    savedAt: row.savedAt ? row.savedAt.toISOString() : null,
    totalPageCount: row.totalPageCount,
    analyzedPageCount: row.analyzedPageCount,
    risk: row.risk,
    label: label(row.totalPageCount),
  };
}

export function toListResponse(
  rows: RecentDocumentRow[],
  hasMore: boolean,
): DocumentListResponse {
  const items = rows.map(toListItem);
  const nextCursor = hasMore && rows.length > 0 ? encodeCursor(rows[rows.length - 1]) : null;
  return { items, nextCursor };
}
