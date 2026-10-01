import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useAnalysis, useAnalysisStore } from "../../../features/analysis";
import { useAuthStore } from "../../../features/auth";
import { useDraftStore } from "../../../features/capture";
import { useUpload, useUploadStore } from "../../../features/upload";
import { useAnalysisSession } from "./useAnalysisSession";

jest.mock("../../../features/upload", () => ({
  ...jest.requireActual("../../../features/upload"),
  useUpload: jest.fn(),
}));
jest.mock("../../../features/analysis", () => ({
  ...jest.requireActual("../../../features/analysis"),
  useAnalysis: jest.fn(),
}));
// capture 배럴은 reanimated UI를 끌어오므로 스토어만 노출.
jest.mock("../../../features/capture", () => ({
  useDraftStore: jest.requireActual("../../../features/capture/model/draftStore").useDraftStore,
}));
// auth 배럴은 카카오 네이티브 모듈을 끌어오므로 최소 스토어로 대체.
jest.mock("../../../features/auth", () => {
  const { create } = jest.requireActual("zustand");
  return {
    getAccessToken: jest.fn(),
    useAuthStore: create(() => ({ user: undefined })),
  };
});

const upload = { start: jest.fn(), retry: jest.fn(), cancel: jest.fn() };
const analysis = { start: jest.fn(), cancel: jest.fn() };

const page = {
  localUri: "file://a.jpg",
  contentType: "image/jpeg",
  sizeBytes: 100,
  width: 10,
  height: 10,
};

beforeEach(() => {
  (useUpload as jest.Mock).mockReturnValue(upload);
  (useAnalysis as jest.Mock).mockReturnValue(analysis);
  useUploadStore.getState().reset();
  useAnalysisStore.getState().reset();
  useDraftStore.getState().setLocked(false);
  useDraftStore.getState().clear();
  useAuthStore.setState({ user: { id: "u1" } } as never);
});

const addPage = () =>
  act(() => {
    useDraftStore.getState().addPage(page as never);
  });

describe("useAnalysisSession", () => {
  it("담은 페이지·업로드 전이면 hasPages·idle", () => {
    addPage();
    const { result } = renderHook(() => useAnalysisSession());
    expect(result.current.hasPages).toBe(true);
    expect(result.current.view.phase).toBe("idle");
  });

  it("analyze는 담은 페이지 스냅샷으로 업로드 시작", () => {
    addPage();
    const { result } = renderHook(() => useAnalysisSession());
    act(() => result.current.actions.analyze());
    expect(upload.start).toHaveBeenCalledTimes(1);
    const [snaps] = upload.start.mock.calls[0];
    expect(snaps).toEqual([
      expect.objectContaining({ localUri: "file://a.jpg", order: 0, contentType: "image/jpeg" }),
    ]);
  });

  it("업로드 확정 시 분석 자동 시작은 문서당 1회", () => {
    const { rerender } = renderHook(() => useAnalysisSession());
    act(() => useUploadStore.getState().set({ phase: "uploaded", documentId: "doc1", ownerUserId: "u1" }));
    rerender({});
    rerender({});
    expect(analysis.start).toHaveBeenCalledTimes(1);
    expect(analysis.start).toHaveBeenCalledWith("doc1", expect.any(Function));
  });

  it("진행 중엔 Draft 편집 잠금, 끝나면 해제", () => {
    renderHook(() => useAnalysisSession());
    act(() => useUploadStore.getState().set({ phase: "uploading", ownerUserId: "u1" }));
    expect(useDraftStore.getState().locked).toBe(true);
    act(() => useUploadStore.getState().reset());
    expect(useDraftStore.getState().locked).toBe(false);
  });

  it("진행 중 계정이 바뀌면 업로드·분석 무효화", () => {
    renderHook(() => useAnalysisSession());
    act(() => useUploadStore.getState().set({ phase: "uploading", ownerUserId: "u1" }));
    expect(upload.cancel).not.toHaveBeenCalled();
    act(() => useAuthStore.setState({ user: { id: "u2" } } as never));
    expect(upload.cancel).toHaveBeenCalled();
    expect(analysis.cancel).toHaveBeenCalled();
  });

  it("cancel: 업로드 중이면 업로드만 취소", () => {
    const { result } = renderHook(() => useAnalysisSession());
    act(() => useUploadStore.getState().set({ phase: "uploading", ownerUserId: "u1" }));
    act(() => result.current.actions.cancel());
    expect(upload.cancel).toHaveBeenCalledTimes(1);
    expect(analysis.cancel).not.toHaveBeenCalled();
  });

  it("cancel: 분석 단계면 분석 취소 + 업로드 세션 초기화", () => {
    const { result } = renderHook(() => useAnalysisSession());
    act(() => {
      useUploadStore.getState().set({ phase: "uploaded", documentId: "doc1", ownerUserId: "u1" });
      useAnalysisStore.getState().set({ phase: "analyzing" });
    });
    act(() => result.current.actions.cancel());
    expect(analysis.cancel).toHaveBeenCalled();
    expect(useUploadStore.getState().phase).toBe("idle");
  });

  it("분석 403(무료 소진)이면 view.errorKind=quota", () => {
    const { result } = renderHook(() => useAnalysisSession());
    act(() => {
      useUploadStore.getState().set({ phase: "uploaded", documentId: "doc1", ownerUserId: "u1" });
      useAnalysisStore.getState().set({ phase: "error", errorKind: "quota" });
    });
    expect(result.current.view).toMatchObject({ phase: "error", errorKind: "quota" });
  });

  it("retry: 업로드 오류면 업로드 재시도", () => {
    addPage();
    const { result } = renderHook(() => useAnalysisSession());
    act(() => useUploadStore.getState().set({ phase: "error" }));
    act(() => result.current.actions.retry());
    expect(upload.retry).toHaveBeenCalledTimes(1);
  });

  it("retry: 분석 실패면 같은 문서로 분석 재시작", () => {
    const { result } = renderHook(() => useAnalysisSession());
    act(() => {
      useUploadStore.getState().set({ phase: "uploaded", documentId: "doc1", ownerUserId: "u1" });
      useAnalysisStore.getState().set({ phase: "failed" });
    });
    analysis.start.mockClear();
    act(() => result.current.actions.retry());
    expect(analysis.start).toHaveBeenCalledWith("doc1", expect.any(Function));
  });

  it("reset: 담은 페이지·업로드·분석 초기화", () => {
    addPage();
    const { result } = renderHook(() => useAnalysisSession());
    act(() => result.current.actions.reset());
    expect(analysis.cancel).toHaveBeenCalled();
    expect(useDraftStore.getState().pages).toHaveLength(0);
    expect(result.current.hasPages).toBe(false);
  });

  it("confirmHome: 확인 다이얼로그 후 '홈으로'에서만 초기화", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    addPage();
    const { result } = renderHook(() => useAnalysisSession());
    act(() => result.current.actions.confirmHome());
    expect(alert).toHaveBeenCalledTimes(1);
    expect(useDraftStore.getState().pages).toHaveLength(1);

    const buttons = alert.mock.calls[0][2]!;
    act(() => buttons.find((b) => b.text === "홈으로")!.onPress!());
    expect(useDraftStore.getState().pages).toHaveLength(0);
  });
});
