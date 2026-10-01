import { createRunGuard } from "./runGuard";

describe("createRunGuard", () => {
  it("nextRun은 현재 세대+1을 계산만 하고 저장하지 않는다", () => {
    let runId = 5;
    const guard = createRunGuard(
      () => runId,
      (v) => {
        runId = v;
      },
    );

    expect(guard.nextRun()).toBe(6);
    expect(runId).toBe(5); // 저장은 안 함
    expect(guard.nextRun()).toBe(6); // 멱등(저장 안 했으니 동일)
  });

  it("bumpRun은 세대를 올려 저장하고 새 번호를 반환한다", () => {
    let runId = 0;
    const guard = createRunGuard(
      () => runId,
      (v) => {
        runId = v;
      },
    );

    expect(guard.bumpRun()).toBe(1);
    expect(runId).toBe(1);
    expect(guard.bumpRun()).toBe(2);
    expect(runId).toBe(2);
  });

  it("isAlive는 현재 세대와 같을 때만 true", () => {
    let runId = 3;
    const guard = createRunGuard(
      () => runId,
      (v) => {
        runId = v;
      },
    );

    const my = guard.nextRun(); // 4
    guard.bumpRun(); // runId = 4 (내 세대)
    expect(guard.isAlive(my)).toBe(true);

    guard.bumpRun(); // runId = 5 (새 실행/취소)
    expect(guard.isAlive(my)).toBe(false); // 이제 stale
  });

  it("getRunId를 매번 최신 상태로 읽는다(스냅샷 캡처 아님)", () => {
    const state = { runId: 10 };
    const guard = createRunGuard(
      () => state.runId,
      (v) => {
        state.runId = v;
      },
    );

    expect(guard.isAlive(10)).toBe(true);
    state.runId = 11; // 외부에서 변경
    expect(guard.isAlive(10)).toBe(false);
    expect(guard.nextRun()).toBe(12);
  });
});
