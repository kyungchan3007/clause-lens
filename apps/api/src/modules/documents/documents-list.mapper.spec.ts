import type { RecentDocumentRow } from "@clause-lens/db/analysis";

import {
  decodeCursor,
  encodeCursor,
  toListItem,
  toListResponse,
} from "./documents-list.mapper";

function makeRow(over: Partial<RecentDocumentRow> = {}): RecentDocumentRow {
  return {
    documentId: "doc1",
    completedAt: new Date("2026-10-01T05:00:00.000Z"),
    retainUntil: new Date("2026-10-08T05:00:00.000Z"),
    status: "done",
    totalPageCount: 3,
    analyzedPageCount: 3,
    risk: { high: 2, medium: 1, low: 0 },
    ...over,
  };
}

describe("documents-list.mapper 커서", () => {
  it("encode→decode 왕복이 completedAt·id를 보존한다", () => {
    const row = makeRow();
    const cursor = encodeCursor(row);
    const decoded = decodeCursor(cursor);
    expect(decoded?.id).toBe("doc1");
    expect(decoded?.completedAt.toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("잘못된 커서는 undefined(첫 페이지)로 관대 처리", () => {
    expect(decodeCursor("!!not-base64!!")).toBeUndefined();
    expect(decodeCursor(Buffer.from('{"c":"nope","id":1}').toString("base64url"))).toBeUndefined();
    expect(decodeCursor(undefined)).toBeUndefined();
  });
});

describe("documents-list.mapper DTO", () => {
  it("라벨은 '계약서 · N장' + ISO 날짜·집계를 그대로 전달", () => {
    const item = toListItem(makeRow({ totalPageCount: 2 }));
    expect(item.label).toBe("계약서 · 2장");
    expect(item.completedAt).toBe("2026-10-01T05:00:00.000Z");
    expect(item.retainUntil).toBe("2026-10-08T05:00:00.000Z");
    expect(item.risk).toEqual({ high: 2, medium: 1, low: 0 });
  });

  it("hasMore=true면 마지막 행으로 nextCursor 발급, 아니면 null", () => {
    const rows = [makeRow({ documentId: "a" }), makeRow({ documentId: "b" })];
    const withMore = toListResponse(rows, true);
    expect(withMore.nextCursor).toBe(encodeCursor(rows[1]));
    expect(withMore.items).toHaveLength(2);

    const last = toListResponse(rows, false);
    expect(last.nextCursor).toBeNull();
  });

  it("빈 결과는 nextCursor=null", () => {
    expect(toListResponse([], false).nextCursor).toBeNull();
  });
});
