// 계정 격리(account isolation) 공통 로직 — documents·entitlement store가 공유.
//
// 비동기 조회(목록·잔량)는 "계정 세대(generation)"로 요청을 식별한다.
// 로그인·계정 변경·로그아웃에서 세대를 올리고(syncAccount), 조회 시작 시
// 세대를 캡처해 응답 반영 전 아직 현재 세대인지(isStaleGeneration) 확인해
// 이전 계정의 늦게 온 응답을 폐기한다. 각 store의 평평한 generation/userId
// 필드를 get/set으로 주입받아 동작은 그대로, 중복 구현만 단일화한다.
//
// 스토어 고유 로직(entitlement inFlight/pending, documents dedupe/pagination)은
// 각 store가 소유한다. 여기서는 격리 세대 관리만 담당한다.

export interface AccountScopedState {
  /** 계정 세대 — 로그인·계정 변경·로그아웃마다 증가. */
  generation: number;
  /** 현재 계정 — null이면 로그아웃. */
  userId: string | null;
}

/**
 * 계정 동기화 — 같은 userId면 no-op, 바뀌면 세대++·userId 갱신·초기화.
 * @param reset 세대 변경 시 함께 반영할 스토어별 초기화 필드(items·data 등).
 *   generation/userId는 헬퍼가 소유하므로 reset에 넣지 않는다.
 */
export function syncAccount<T extends AccountScopedState>(
  get: () => T,
  set: (partial: Partial<T>) => void,
  userId: string | null,
  reset: Partial<T>,
): void {
  if (get().userId === userId) return;
  set({ ...reset, generation: get().generation + 1, userId } as Partial<T>);
}

/**
 * 캡처한 세대(gen)가 더 이상 현재 세대가 아닌지 — true면 stale(계정 변경됨 → 응답 폐기).
 * 항상 최신 store 상태를 읽어 판정한다.
 */
export function isStaleGeneration(get: () => AccountScopedState, gen: number): boolean {
  return get().generation !== gen;
}
