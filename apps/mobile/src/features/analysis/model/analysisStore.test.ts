import { useAnalysisStore } from "./analysisStore";

const store = () => useAnalysisStore.getState();

beforeEach(() => {
  useAnalysisStore.getState().reset();
  useAnalysisStore.setState({ runId: 0 });
});

describe("analysisStore.bumpRunWith", () => {
  it("runId를 +1 하며 patch를 한 번에(원자적으로) 반영한다", () => {
    const seen: Array<{ runId: number; phase: string }> = [];
    const unsub = useAnalysisStore.subscribe((s) =>
      seen.push({ runId: s.runId, phase: s.phase }),
    );

    const next = store().bumpRunWith({ phase: "requesting", documentId: "doc1" });

    expect(next).toBe(1);
    expect(store().runId).toBe(1);
    expect(store().phase).toBe("requesting");
    expect(store().documentId).toBe("doc1");
    // runId와 phase가 같은 set으로 올라감 → 알림 1회, 중간 상태 없음.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ runId: 1, phase: "requesting" });

    unsub();
  });

  it("reset 뒤에도 현재 세대 기준으로 +1 한다(cancel/start 경로 보존)", () => {
    useAnalysisStore.setState({ runId: 7 });
    store().reset(); // reset은 runId를 보존
    expect(store().runId).toBe(7);
    const next = store().bumpRunWith({});
    expect(next).toBe(8);
    expect(store().runId).toBe(8);
  });

  it("patch는 runId를 덮지 못한다(세대는 bumpRunWith만 올린다)", () => {
    const next = store().bumpRunWith({ runId: 99, phase: "analyzing" } as never);
    expect(next).toBe(1);
    expect(store().runId).toBe(1);
  });

  it("set은 runId를 바꾸지 않는다(세대 증가는 bumpRunWith 전용 경로)", () => {
    store().bumpRunWith({ phase: "requesting" }); // runId = 1
    store().set({ phase: "analyzing" });
    expect(store().runId).toBe(1); // set은 세대를 건드리지 않음
    expect(store().phase).toBe("analyzing");
  });
});
