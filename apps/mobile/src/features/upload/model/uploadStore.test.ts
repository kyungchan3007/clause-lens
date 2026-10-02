import { useUploadStore } from "./uploadStore";

const store = () => useUploadStore.getState();

beforeEach(() => {
  useUploadStore.getState().reset();
  useUploadStore.setState({ runId: 0 });
});

describe("uploadStore.bumpRunWith", () => {
  it("runId를 +1 하며 patch를 한 번에(원자적으로) 반영한다", () => {
    const seen: Array<{ runId: number; phase: string }> = [];
    const unsub = useUploadStore.subscribe((s) =>
      seen.push({ runId: s.runId, phase: s.phase }),
    );

    const next = store().bumpRunWith({ phase: "presigning", message: "시작" });

    expect(next).toBe(1);
    expect(store().runId).toBe(1);
    expect(store().phase).toBe("presigning");
    expect(store().message).toBe("시작");
    // runId와 phase가 같은 set으로 올라감 → 알림은 1회, 중간 상태(runId만/ phase만) 없음.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ runId: 1, phase: "presigning" });

    unsub();
  });

  it("호출마다 현재 세대 기준으로 증가한다", () => {
    expect(store().bumpRunWith({ phase: "uploading" })).toBe(1);
    expect(store().bumpRunWith({ phase: "confirming" })).toBe(2);
    expect(store().runId).toBe(2);
    expect(store().phase).toBe("confirming");
  });

  it("patch는 runId를 덮지 못한다(세대는 bumpRunWith만 올린다)", () => {
    // 타입상 runId는 막혀 있으나, 런타임에서도 마지막 spread로 항상 +1이 이긴다.
    const next = store().bumpRunWith({ runId: 99, phase: "idle" } as never);
    expect(next).toBe(1);
    expect(store().runId).toBe(1);
  });

  it("set은 runId를 바꾸지 않는다(세대 증가는 bumpRunWith 전용 경로)", () => {
    store().bumpRunWith({ phase: "uploading" }); // runId = 1
    store().set({ phase: "confirming", message: "진행" });
    expect(store().runId).toBe(1); // set은 세대를 건드리지 않음
    expect(store().phase).toBe("confirming");
  });
});
