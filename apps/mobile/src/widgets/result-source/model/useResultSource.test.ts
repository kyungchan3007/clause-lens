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
    useAnalysisStore.getState().set({ documentId: "doc1", pages: [page] });
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

  it("업로드 페이지가 그대로면 imageByPageId 참조 유지(불필요 재렌더 방지)", () => {
    seedLive();
    const { result, rerender } = renderHook(() => useResultSource("doc1"));
    const first = result.current.kind === "live" ? result.current.imageByPageId : undefined;
    rerender({});
    const second = result.current.kind === "live" ? result.current.imageByPageId : undefined;
    expect(second).toBe(first);
  });
});
