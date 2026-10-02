import { act, renderHook } from "@testing-library/react-native";

import { useAnalysisStore } from "../../../features/analysis";
import { useAuthStore } from "../../../features/auth";
import { useUploadStore } from "../../../features/upload";
import { useResultSource } from "./useResultSource";

// auth 배럴은 카카오 네이티브 모듈을 끌어오므로 최소 스토어로 대체.
jest.mock("../../../features/auth", () => {
  const { create } = jest.requireActual("zustand");
  return { useAuthStore: create(() => ({ user: undefined })) };
});

const page = { pageId: "p1", status: "done" } as never;

const seedLive = () =>
  act(() => {
    useAuthStore.setState({ user: { id: "u1" } } as never);
    useAnalysisStore.getState().set({ documentId: "doc1", ownerUserId: "u1", pages: [page] });
    useUploadStore.getState().set({
      documentId: "doc1",
      ownerUserId: "u1",
      pages: [
        {
          draftId: "d1",
          order: 0,
          pageId: "p1",
          put: true,
          server: "uploaded",
          image: { localUri: "file://1.jpg", width: 10, height: 20 },
        },
      ],
    });
  });

beforeEach(() => {
  useAuthStore.setState({ user: undefined } as never);
  useAnalysisStore.getState().reset();
  useUploadStore.getState().reset();
});

describe("useResultSource", () => {
  it("documentId가 없으면 none", () => {
    const { result } = renderHook(() => useResultSource(undefined));
    expect(result.current).toEqual({ kind: "none" });
  });

  it("방금 분석한 내 문서면 live(결과·이미지 포함)", () => {
    seedLive();
    const { result } = renderHook(() => useResultSource("doc1"));
    expect(result.current).toEqual({
      kind: "live",
      documentId: "doc1",
      pages: [page],
      imageByPageId: { p1: { uri: "file://1.jpg", width: 10, height: 20 } },
    });
  });

  it("다른 문서면 review(서버 재열람)", () => {
    seedLive();
    const { result } = renderHook(() => useResultSource("doc2"));
    expect(result.current).toEqual({ kind: "review", documentId: "doc2" });
  });

  it("계정이 바뀌면 메모리 결과 대신 review(결과 격리)", () => {
    seedLive();
    const { result } = renderHook(() => useResultSource("doc1"));
    expect(result.current.kind).toBe("live");
    act(() => useAuthStore.setState({ user: { id: "u2" } } as never));
    expect(result.current).toEqual({ kind: "review", documentId: "doc1" });
  });

  it("분석만 내 것이고 업로드 스냅샷이 다른 문서면 live·목록-only(이미지 없음)", () => {
    seedLive();
    // 업로드 스냅샷만 다른 문서로(같은 사용자, 새 문서 진행 후 이전 결과 열람).
    act(() => useUploadStore.getState().set({ documentId: "docX" }));
    const { result } = renderHook(() => useResultSource("doc1"));
    expect(result.current).toEqual({
      kind: "live",
      documentId: "doc1",
      pages: [page],
      imageByPageId: {}, // 목록-only 저하
    });
  });

  it("업로드 소유자만 현재 사용자여도 이전 분석(소유자 다름)이면 review(격리)", () => {
    seedLive();
    // 이전 계정(u2)의 분석이 남아 있고 로그인은 u1, 업로드도 u1 것 → 가시성은 분석 기준이라 차단.
    act(() => useAnalysisStore.getState().set({ ownerUserId: "u2" }));
    const { result } = renderHook(() => useResultSource("doc1"));
    expect(result.current).toEqual({ kind: "review", documentId: "doc1" });
  });

  it("업로드 페이지가 그대로면 imageByPageId 참조 유지(불필요 재렌더 방지)", () => {
    seedLive();
    const { result, rerender } = renderHook(() => useResultSource("doc1"));
    const first = result.current.kind === "live" ? result.current.imageByPageId : undefined;
    rerender({});
    const second = result.current.kind === "live" ? result.current.imageByPageId : undefined;
    expect(second).toBe(first);
  });
});
