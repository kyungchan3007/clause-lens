import { isLiveResult, toImageByPageId, type LiveResultInput } from "./resultSource";

const live: LiveResultInput = {
  requestedDocId: "doc1",
  userId: "u1",
  analysisDocId: "doc1",
  uploadDocId: "doc1",
  uploadOwner: "u1",
  pageCount: 2,
};

describe("isLiveResult", () => {
  it("문서 id·소유자 일치 + 결과 있음이면 live", () => {
    expect(isLiveResult(live)).toBe(true);
  });

  it.each<[string, Partial<LiveResultInput>]>([
    ["요청 문서 없음", { requestedDocId: undefined }],
    ["분석 문서 불일치", { analysisDocId: "doc2" }],
    ["업로드 문서 불일치", { uploadDocId: "doc2" }],
    ["로그인 사용자 없음", { userId: undefined, uploadOwner: undefined }],
    ["소유자 불일치(다른 계정 결과 격리)", { userId: "u2" }],
    ["결과 0건", { pageCount: 0 }],
  ])("%s이면 live 아님", (_, patch) => {
    expect(isLiveResult({ ...live, ...patch })).toBe(false);
  });
});

describe("toImageByPageId", () => {
  it("pageId·이미지가 모두 있는 페이지만 매핑", () => {
    const map = toImageByPageId([
      { draftId: "d1", order: 0, pageId: "p1", put: true, server: "uploaded", image: { localUri: "file://1.jpg", width: 10, height: 20 } },
      { draftId: "d2", order: 1, pageId: "p2", put: true, server: "uploaded" },
      { draftId: "d3", order: 2, put: false, server: "pending", image: { localUri: "file://3.jpg", width: 1, height: 1 } },
    ]);
    expect(map).toEqual({ p1: { uri: "file://1.jpg", width: 10, height: 20 } });
  });

  it("업로드 페이지가 없으면 빈 맵", () => {
    expect(toImageByPageId(undefined)).toEqual({});
    expect(toImageByPageId([])).toEqual({});
  });
});
