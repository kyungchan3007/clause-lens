import { normalizedImageKey } from "@clause-lens/contracts";

import { documentDeletionKeys } from "./retention.keys";

// 삭제 대상 S3 키 열거(#164): finalKey(null 스킵)·정규화(헬퍼)·tmp·중복 제거.
describe("documentDeletionKeys (#164)", () => {
  const doc = "doc1";
  const user = "u1";

  it("페이지별 finalKey·정규화·tmp 키를 모은다", () => {
    const keys = documentDeletionKeys(doc, {
      userId: user,
      pages: [{ pageId: "pg1", finalKey: "documents/doc1/pages/pg1/r1/abc", revision: 1 }],
    });
    expect(keys).toContain("documents/doc1/pages/pg1/r1/abc");
    expect(keys).toContain(normalizedImageKey(doc, "pg1", 1));
    expect(keys).toContain("tmp/u1/doc1/pg1");
    expect(keys).toHaveLength(3);
  });

  it("finalKey null이면 스킵(가짜 키 안 만듦) — 정규화·tmp만", () => {
    const keys = documentDeletionKeys(doc, {
      userId: user,
      pages: [{ pageId: "pg1", finalKey: null, revision: 1 }],
    });
    expect(keys).toEqual([normalizedImageKey(doc, "pg1", 1), "tmp/u1/doc1/pg1"]);
  });

  it("여러 페이지 + 중복 제거", () => {
    const keys = documentDeletionKeys(doc, {
      userId: user,
      pages: [
        { pageId: "pg1", finalKey: "k1", revision: 1 },
        { pageId: "pg2", finalKey: "k2", revision: 2 },
      ],
    });
    expect(keys).toContain("k1");
    expect(keys).toContain("k2");
    expect(keys).toContain(normalizedImageKey(doc, "pg2", 2));
    expect(new Set(keys).size).toBe(keys.length); // 중복 없음
  });

  it("페이지 없으면 빈 배열", () => {
    expect(documentDeletionKeys(doc, { userId: user, pages: [] })).toEqual([]);
  });
});
