import { isStaleGeneration, syncAccount } from "./accountScopedStore";

interface TestState {
  generation: number;
  userId: string | null;
  items: number[];
  flag: boolean;
}

function makeStore(initial: TestState) {
  let state: TestState = { ...initial };
  return {
    get: () => state,
    set: (partial: Partial<TestState>) => {
      state = { ...state, ...partial };
    },
    current: () => state,
  };
}

describe("accountScopedStore.syncAccount", () => {
  it("같은 userId면 no-op (세대·필드 유지)", () => {
    const s = makeStore({ generation: 1, userId: "u1", items: [1], flag: true });
    syncAccount(s.get, s.set, "u1", { items: [], flag: false });
    expect(s.current()).toEqual({ generation: 1, userId: "u1", items: [1], flag: true });
  });

  it("userId 변경 → 세대++·userId 갱신·reset 반영", () => {
    const s = makeStore({ generation: 1, userId: "u1", items: [1, 2], flag: true });
    syncAccount(s.get, s.set, "u2", { items: [], flag: false });
    expect(s.current()).toEqual({ generation: 2, userId: "u2", items: [], flag: false });
  });

  it("로그아웃(null) → 세대++·userId null·reset", () => {
    const s = makeStore({ generation: 5, userId: "u1", items: [1], flag: true });
    syncAccount(s.get, s.set, null, { items: [], flag: false });
    expect(s.current()).toEqual({ generation: 6, userId: null, items: [], flag: false });
  });

  it("reset으로 generation/userId를 덮지 못함(헬퍼가 소유)", () => {
    const s = makeStore({ generation: 1, userId: "u1", items: [], flag: false });
    syncAccount(s.get, s.set, "u2", {
      generation: 99,
      userId: "spoof",
      items: [],
      flag: false,
    } as Partial<TestState>);
    expect(s.current().generation).toBe(2);
    expect(s.current().userId).toBe("u2");
  });
});

describe("accountScopedStore.isStaleGeneration", () => {
  it("세대 일치 → false(최신)", () => {
    const s = makeStore({ generation: 3, userId: null, items: [], flag: false });
    expect(isStaleGeneration(s.get, 3)).toBe(false);
  });

  it("세대 불일치 → true(폐기)", () => {
    const s = makeStore({ generation: 4, userId: null, items: [], flag: false });
    expect(isStaleGeneration(s.get, 3)).toBe(true);
  });

  it("항상 최신 상태를 읽는다", () => {
    const s = makeStore({ generation: 1, userId: null, items: [], flag: false });
    const gen = s.current().generation;
    s.set({ generation: 2 }); // 캡처 후 세대 증가
    expect(isStaleGeneration(s.get, gen)).toBe(true);
  });
});
