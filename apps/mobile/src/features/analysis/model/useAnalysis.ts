import { useCallback } from "react";
import type { AnalysisStatusResponse } from "@clause-lens/contracts";

import {
  fetchStatus,
  openStatusStream,
  requestAnalysis,
} from "../api/analysisApi";
import { useAnalysisStore, type AnalysisPhase } from "./analysisStore";

// 호출 직전 토큰·소유자 취득(장기 캡처 금지) — upload의 getAuth 재사용 가능.
export type GetAnalysisAuth = () => Promise<{
  accessToken: string;
  userId: string;
} | null>;

const POLL_MS = 5000; // 저빈도 GET 보정(SSE 이벤트 유실 대비)
const REOPEN_BACKOFF_MS = 2000;

// 실행 세대(runId)로 stale 콜백·취소를 무효화. 활성 자원은 모듈 레벨로 관리.
let streamClose: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reopenTimer: ReturnType<typeof setTimeout> | null = null;

function teardown(): void {
  streamClose?.();
  streamClose = null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (reopenTimer) {
    clearTimeout(reopenTimer);
    reopenTimer = null;
  }
}

function alive(runId: number): boolean {
  return useAnalysisStore.getState().runId === runId;
}

function phaseFromStatus(s: AnalysisStatusResponse): AnalysisPhase {
  switch (s.status) {
    case "done":
      return "done";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
    default:
      return "analyzing";
  }
}

function isTerminal(p: AnalysisPhase): boolean {
  return p === "done" || p === "partial" || p === "failed";
}

// 서버 상태를 store에 반영 — 같은 job의 큰 stateVersion만 적용(역순 도착 방지).
function applyStatus(status: AnalysisStatusResponse, runId: number): void {
  if (!alive(runId)) return;
  const st = useAnalysisStore.getState();
  if (st.jobId && status.jobId !== st.jobId) return;
  if (status.stateVersion < st.stateVersion) return;

  const phase = phaseFromStatus(status);
  const doneCount = status.pages.filter((p) => p.status === "done").length;
  st.set({
    jobId: status.jobId,
    documentId: status.documentId,
    stateVersion: status.stateVersion,
    phase,
    pages: status.pages,
    doneCount,
    totalCount: status.job.totalPages,
    message:
      phase === "partial"
        ? "일부 페이지 분석에 실패했어요"
        : phase === "failed"
          ? "분석에 실패했어요"
          : undefined,
  });
  if (isTerminal(phase)) teardown();
}

function beginWatch(documentId: string, token: string, runId: number): void {
  const open = (): void => {
    streamClose = openStatusStream(token, documentId, {
      onStatus: (s) => applyStatus(s, runId),
      onError: () => {
        streamClose?.();
        streamClose = null;
        if (!alive(runId)) return;
        // 재연결: 백오프 후 현재 상태 재fetch(놓친 이벤트 보정) + 재오픈.
        reopenTimer = setTimeout(() => {
          if (!alive(runId)) return;
          void fetchStatus(token, documentId)
            .then((s) => {
              if (!alive(runId)) return;
              applyStatus(s, runId);
              if (!isTerminal(useAnalysisStore.getState().phase)) open();
            })
            .catch(() => {
              /* 다음 폴링이 보정 */
            });
        }, REOPEN_BACKOFF_MS);
      },
    });
  };
  open();

  pollTimer = setInterval(() => {
    if (!alive(runId)) {
      teardown();
      return;
    }
    void fetchStatus(token, documentId)
      .then((s) => applyStatus(s, runId))
      .catch(() => {
        /* 일시 실패는 다음 주기/이벤트가 보정 */
      });
  }, POLL_MS);
}

export function useAnalysis() {
  const start = useCallback(
    async (documentId: string, getAuth: GetAnalysisAuth): Promise<void> => {
      teardown();
      const runId = useAnalysisStore.getState().runId + 1;
      useAnalysisStore.getState().reset();
      useAnalysisStore.getState().set({ runId, documentId, phase: "requesting" });

      const auth = await getAuth();
      if (!alive(runId)) return;
      if (!auth) {
        useAnalysisStore
          .getState()
          .set({ phase: "error", message: "로그인이 필요해요" });
        return;
      }

      try {
        const status = await requestAnalysis(auth.accessToken, documentId);
        if (!alive(runId)) return;
        applyStatus(status, runId);
        if (!isTerminal(phaseFromStatus(status))) {
          beginWatch(documentId, auth.accessToken, runId);
        }
      } catch {
        if (!alive(runId)) return;
        useAnalysisStore
          .getState()
          .set({ phase: "error", message: "분석 요청에 실패했어요" });
      }
    },
    [],
  );

  const cancel = useCallback((): void => {
    const runId = useAnalysisStore.getState().runId + 1;
    teardown();
    useAnalysisStore.getState().reset();
    useAnalysisStore.getState().set({ runId });
  }, []);

  return { start, cancel };
}
