import { renderHook, act } from "@testing-library/react-native";
import type { AnalysisStatusResponse } from "@clause-lens/contracts";

import {
  fetchStatus,
  openStatusStream,
  requestAnalysis,
  type StreamHandlers,
} from "../api/analysisApi";
import { HttpError } from "../../../shared/http";
import { useAnalysis } from "./useAnalysis";
import { useAnalysisStore } from "./analysisStore";

// 함수는 모킹하되 HttpError는 실제 공유 클래스 유지(useAnalysis의 instanceof 분기 검증용).
jest.mock("../api/analysisApi", () => ({
  HttpError: jest.requireActual("../../../shared/http").HttpError,
  requestAnalysis: jest.fn(),
  openStatusStream: jest.fn(),
  fetchStatus: jest.fn(),
}));

const requestMock = requestAnalysis as jest.MockedFunction<typeof requestAnalysis>;
const streamMock = openStatusStream as jest.MockedFunction<typeof openStatusStream>;
const fetchMock = fetchStatus as jest.MockedFunction<typeof fetchStatus>;

const auth = async () => ({ accessToken: "t", userId: "u1" });

function status(over: Partial<AnalysisStatusResponse> = {}): AnalysisStatusResponse {
  return {
    jobId: "job1",
    documentId: "doc1",
    status: "analyzing",
    stateVersion: 1,
    job: { status: "processing", totalPages: 2 },
    pages: [
      { pageId: "pg1", order: 0, status: "pending", revision: 1 },
      { pageId: "pg2", order: 1, status: "pending", revision: 1 },
    ],
    ...over,
  };
}

beforeEach(() => {
  useAnalysisStore.getState().reset();
  useAnalysisStore.setState({ runId: 0 });
  streamMock.mockReturnValue(() => {});
});

describe("useAnalysis.start", () => {
  it("즉시 done이면 스트림 안 열고 done 상태", async () => {
    requestMock.mockResolvedValue(
      status({ status: "done", stateVersion: 3, pages: [] }),
    );
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.start("doc1", auth);
    });

    expect(useAnalysisStore.getState().phase).toBe("done");
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("접수 403 → 무료 횟수 없음 안내(그 외 오류와 구분)", async () => {
    requestMock.mockRejectedValue(new HttpError(403));
    const { result } = renderHook(() => useAnalysis());
    await act(async () => {
      await result.current.start("doc1", auth);
    });
    const s = useAnalysisStore.getState();
    expect(s.phase).toBe("error");
    expect(s.message).toBe("현재 사용할 수 있는 무료 분석 횟수가 없어요");
  });

  it("접수 403 외 오류(500) → 일반 실패 메시지", async () => {
    requestMock.mockRejectedValue(new HttpError(500));
    const { result } = renderHook(() => useAnalysis());
    await act(async () => {
      await result.current.start("doc1", auth);
    });
    const s = useAnalysisStore.getState();
    expect(s.phase).toBe("error");
    expect(s.message).toBe("분석 요청에 실패했어요");
  });

  it("진행 중이면 스트림 구독 시작", async () => {
    requestMock.mockResolvedValue(status());
    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.start("doc1", auth);
    });

    expect(useAnalysisStore.getState().phase).toBe("analyzing");
    expect(streamMock).toHaveBeenCalledTimes(1);

    act(() => result.current.cancel()); // 타이머 정리
  });

  it("스트림 status 콜백: 큰 stateVersion만 적용(역순 무시)", async () => {
    requestMock.mockResolvedValue(status({ stateVersion: 2 }));
    let handlers: StreamHandlers | undefined;
    streamMock.mockImplementation((_t, _d, h) => {
      handlers = h;
      return () => {};
    });
    const { result } = renderHook(() => useAnalysis());
    await act(async () => {
      await result.current.start("doc1", auth);
    });

    // 역순(더 낮은 버전) → 무시
    act(() => handlers?.onStatus(status({ stateVersion: 1, status: "done" })));
    expect(useAnalysisStore.getState().phase).toBe("analyzing");

    // 더 큰 버전 done → 적용 + 종결
    act(() =>
      handlers?.onStatus(
        status({ stateVersion: 3, status: "done", pages: [] }),
      ),
    );
    expect(useAnalysisStore.getState().phase).toBe("done");

    act(() => result.current.cancel());
  });

  it("요청 실패 → error 상태", async () => {
    requestMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAnalysis());
    await act(async () => {
      await result.current.start("doc1", auth);
    });
    expect(useAnalysisStore.getState().phase).toBe("error");
  });
});
