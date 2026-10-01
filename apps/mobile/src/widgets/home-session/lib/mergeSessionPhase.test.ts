import { mergeSessionPhase, type SessionSources } from "./mergeSessionPhase";

const base: SessionSources = {
  uploadPhase: "idle",
  sentCount: 1,
  totalCount: 3,
  uploadMessage: "up-msg",
  analysisPhase: "idle",
  analysisDone: 2,
  analysisTotal: 5,
  analysisMessage: "an-msg",
  analysisErrorKind: undefined,
};

describe("mergeSessionPhase", () => {
  it("업로드 전(idle)이면 idle·카운트 0", () => {
    expect(mergeSessionPhase(base)).toEqual({ phase: "idle", sentCount: 0, totalCount: 0 });
  });

  it.each(["presigning", "uploading", "confirming"] as const)(
    "업로드 활성(%s)이면 업로드 phase·카운트·메시지",
    (uploadPhase) => {
      expect(mergeSessionPhase({ ...base, uploadPhase })).toEqual({
        phase: uploadPhase,
        sentCount: 1,
        totalCount: 3,
        message: "up-msg",
      });
    },
  );

  it("업로드 오류는 분석 상태와 무관하게 error", () => {
    expect(mergeSessionPhase({ ...base, uploadPhase: "error", analysisPhase: "analyzing" })).toEqual({
      phase: "error",
      sentCount: 1,
      totalCount: 3,
      message: "up-msg",
    });
  });

  it("업로드 확정 + 분석 idle이면 uploaded(업로드 카운트, 메시지 없음)", () => {
    expect(mergeSessionPhase({ ...base, uploadPhase: "uploaded" })).toEqual({
      phase: "uploaded",
      sentCount: 1,
      totalCount: 3,
    });
  });

  it.each(["requesting", "analyzing", "done", "partial", "failed", "error"] as const)(
    "업로드 확정 + 분석 %s이면 분석 phase·분석 카운트·메시지",
    (analysisPhase) => {
      expect(mergeSessionPhase({ ...base, uploadPhase: "uploaded", analysisPhase })).toEqual({
        phase: analysisPhase,
        sentCount: 2,
        totalCount: 5,
        message: "an-msg",
        errorKind: undefined,
      });
    },
  );

  it("분석 403(무료 소진)이면 errorKind=quota 전달 — 무료 소진 화면 분기용(#114 회귀 방지)", () => {
    expect(
      mergeSessionPhase({
        ...base,
        uploadPhase: "uploaded",
        analysisPhase: "error",
        analysisErrorKind: "quota",
      }),
    ).toMatchObject({ phase: "error", errorKind: "quota" });
  });
});
