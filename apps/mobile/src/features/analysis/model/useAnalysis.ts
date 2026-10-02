import { useCallback } from "react";
import type { AnalysisStatusResponse } from "@clause-lens/contracts";

import {
  fetchStatus,
  openStatusStream,
  requestAnalysis,
} from "../api/analysisApi";
import { createRunGuard } from "../../../shared/lib/runGuard";
import { classifyHttpError } from "../../../shared/lib/httpError";
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

// 실행 세대 가드 — stale 판정(isAlive)만. 세대 증가는 store.bumpRunWith 전용 경로.
// teardown(타이머·스트림 자원 정리)은 feature 자원이라 아래에 그대로 둔다.
const runGuard = createRunGuard(() => useAnalysisStore.getState().runId);

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
  if (!runGuard.isAlive(runId)) return;
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
        if (!runGuard.isAlive(runId)) return;
        // 재연결: 백오프 후 현재 상태 재fetch(놓친 이벤트 보정) + 재오픈.
        reopenTimer = setTimeout(() => {
          if (!runGuard.isAlive(runId)) return;
          void fetchStatus(token, documentId)
            .then((s) => {
              if (!runGuard.isAlive(runId)) return;
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
    if (!runGuard.isAlive(runId)) {
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
      useAnalysisStore.getState().reset();
      // reset은 runId를 보존하므로, 그 뒤 bumpRunWith가 현재 세대+1을 documentId·phase와
      // 한 set으로 원자적 반영(기존 reset → set({ runId: nextRun(), ... }) 등가 · set 횟수 동일).
      const runId = useAnalysisStore
        .getState()
        .bumpRunWith({ documentId, phase: "requesting" });

      const auth = await getAuth();
      if (!runGuard.isAlive(runId)) return;
      if (!auth) {
        useAnalysisStore
          .getState()
          .set({ phase: "error", message: "로그인이 필요해요" });
        return;
      }

      try {
        const status = await requestAnalysis(auth.accessToken, documentId);
        if (!runGuard.isAlive(runId)) return;
        applyStatus(status, runId);
        if (!isTerminal(phaseFromStatus(status))) {
          beginWatch(documentId, auth.accessToken, runId);
        }
      } catch (e) {
        if (!runGuard.isAlive(runId)) return;
        // 접수 403 = 가용 무료 횟수 없음(소유권 실패=404·업로드 전=409). 예약 때문일 수도 있어
        // "모두 사용"으로 단정하지 않는다. 잔량 갱신은 상위 동기화 훅이 phase=error에서 수행.
        // 분류는 공통(classifyHttpError), 문구·errorKind는 analysis 소유.
        const isQuota = classifyHttpError(e) === "quota";
        const message = isQuota
          ? "현재 사용할 수 있는 무료 분석 횟수가 없어요"
          : "분석 요청에 실패했어요";
        // 403 = 무료 소진 → 전용 화면 분기(errorKind). 다른 error는 제네릭.
        useAnalysisStore
          .getState()
          .set({ phase: "error", message, errorKind: isQuota ? "quota" : undefined });
      }
    },
    [],
  );

  const cancel = useCallback((): void => {
    teardown();
    // reset은 runId를 보존하므로, 그 뒤 bumpRunWith가 현재 세대+1을 set → 취소 시점 세대 증가.
    // 기존 reset → set({ runId: nextRun() })와 최종 runId·set 횟수 동일(reset이 runId 미변경).
    useAnalysisStore.getState().reset();
    useAnalysisStore.getState().bumpRunWith({});
  }, []);

  return { start, cancel };
}
