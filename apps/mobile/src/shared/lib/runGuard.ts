// 실행 세대(runId) 가드 — stale 콜백/취소 무효화 패턴의 공통화(읽기 전용).
//
// 비동기 실행(업로드·분석)은 "세대 번호(runId)"로 자신을 식별한다.
// 진행 중이던 콜백은 자신의 runId가 아직 현재 세대인지(isAlive)로 stale 여부를
// 판별해 폐기한다. 세대를 올리는 쓰기는 각 store의 전용 액션 `bumpRunWith(patch)`가
// 소유한다(runId 증가와 다른 필드 변경을 한 set으로 원자적 반영 → 외부 raw set 차단).
// 그래서 이 가드는 현재 세대를 읽어 판정만 한다(쓰기 경로는 store에 캡슐화).
//
// 자원 정리(타이머·스트림 teardown)는 feature별 자원이라 각 훅이 소유한다.
export interface RunGuard {
  /** runId가 아직 현재 세대인지 — false면 stale(취소·재시작됨). */
  isAlive: (runId: number) => boolean;
}

/**
 * store의 runId 필드를 getter로 받아 세대 판정 가드를 만든다.
 * @param getRunId 현재 세대 번호를 읽는다(항상 최신 store 상태 기준).
 */
export function createRunGuard(getRunId: () => number): RunGuard {
  return {
    isAlive: (runId: number) => getRunId() === runId,
  };
}
