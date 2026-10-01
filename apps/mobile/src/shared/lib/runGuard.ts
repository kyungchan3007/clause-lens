// 실행 세대(runId) 가드 — stale 콜백/취소 무효화 패턴의 공통화.
//
// 비동기 실행(업로드·분석)은 "세대 번호(runId)"로 자신을 식별한다.
// 새 실행을 시작하거나 취소하면 세대를 올리고(nextRun/bumpRun),
// 진행 중이던 콜백은 자신의 runId가 아직 현재 세대인지(isAlive)로
// stale 여부를 판별해 폐기한다. 각 feature store의 `runId: number`
// 필드를 getter/setter로 주입받아 동작은 그대로, 구현만 단일화한다.
//
// 자원 정리(타이머·스트림 teardown)는 feature별 자원이라 각 훅이 소유한다.
export interface RunGuard {
  /** 다음 세대 번호를 계산만 한다(저장은 호출측 set에 위임 — 다른 필드와 묶어 원자적으로 반영). */
  nextRun: () => number;
  /** 세대를 하나 올려 저장하고 새 번호를 반환한다(단독 bump가 필요한 경우). */
  bumpRun: () => number;
  /** runId가 아직 현재 세대인지 — false면 stale(취소·재시작됨). */
  isAlive: (runId: number) => boolean;
}

/**
 * store의 runId 필드를 getter/setter로 받아 세대 가드를 만든다.
 * @param getRunId 현재 세대 번호를 읽는다(항상 최신 store 상태 기준).
 * @param setRunId 세대 번호를 저장한다(bumpRun에서만 사용).
 */
export function createRunGuard(
  getRunId: () => number,
  setRunId: (runId: number) => void,
): RunGuard {
  return {
    nextRun: () => getRunId() + 1,
    bumpRun: () => {
      const next = getRunId() + 1;
      setRunId(next);
      return next;
    },
    isAlive: (runId: number) => getRunId() === runId,
  };
}
