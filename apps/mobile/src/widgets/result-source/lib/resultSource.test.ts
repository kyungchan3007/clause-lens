import {
  canUseAnalysisSnapshot,
  canUseUploadImages,
  toImageByPageId,
  type ResultGateInput,
} from "./resultSource";

const base: ResultGateInput = {
  requestedDocId: "doc1",
  userId: "u1",
  analysisDocId: "doc1",
  analysisOwner: "u1",
  uploadDocId: "doc1",
  uploadOwner: "u1",
  pageCount: 2,
};

describe("canUseAnalysisSnapshot (결과 가시성 = 분석 소유)", () => {
  it("분석 문서·소유자 일치 + 결과 있음이면 가시", () => {
    expect(canUseAnalysisSnapshot(base)).toBe(true);
  });

  it.each<[string, Partial<ResultGateInput>]>([
    ["요청 문서 없음", { requestedDocId: undefined }],
    ["분석 문서 불일치", { analysisDocId: "doc2" }],
    ["로그인 사용자 없음", { userId: undefined, analysisOwner: undefined }],
    ["분석 소유자 불일치(다른 계정 결과 격리)", { analysisOwner: "u2" }],
    ["결과 0건", { pageCount: 0 }],
    ["소유자 둘 다 없음(null===null 통과 금지)", { userId: undefined }],
  ])("%s이면 가시 아님", (_, patch) => {
    expect(canUseAnalysisSnapshot({ ...base, ...patch })).toBe(false);
  });

  it("업로드 소유자만 현재 사용자여도 분석 소유자가 다르면 차단(핵심 격리)", () => {
    // 이전 계정(u2)의 분석이 남아 있고, 업로드만 현재 사용자(u1) 것 → 가시성은 분석 기준이라 차단.
    expect(canUseAnalysisSnapshot({ ...base, analysisOwner: "u2", uploadOwner: "u1" })).toBe(false);
  });
});

describe("canUseUploadImages (이미지 오버레이 = 업로드 소유)", () => {
  it("업로드 문서·소유자 일치면 이미지 사용 가능", () => {
    expect(canUseUploadImages(base)).toBe(true);
  });

  it.each<[string, Partial<ResultGateInput>]>([
    ["업로드 문서 불일치(다른 문서 스냅샷)", { uploadDocId: "doc2" }],
    ["업로드 소유자 불일치", { uploadOwner: "u2" }],
    ["로그인 사용자 없음", { userId: undefined, uploadOwner: undefined }],
  ])("%s이면 이미지 불가(목록-only)", (_, patch) => {
    expect(canUseUploadImages({ ...base, ...patch })).toBe(false);
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
