import { createRunGuard } from "./runGuard";

describe("createRunGuard", () => {
  it("isAlive는 현재 세대와 같을 때만 true", () => {
    let runId = 3;
    const guard = createRunGuard(() => runId);

    expect(guard.isAlive(3)).toBe(true);
    runId = 4; // 새 실행/취소로 세대 증가
    expect(guard.isAlive(3)).toBe(false); // 이제 stale
    expect(guard.isAlive(4)).toBe(true);
  });

  it("getRunId를 매번 최신 상태로 읽는다(스냅샷 캡처 아님)", () => {
    const state = { runId: 10 };
    const guard = createRunGuard(() => state.runId);

    expect(guard.isAlive(10)).toBe(true);
    state.runId = 11; // 외부에서 변경
    expect(guard.isAlive(10)).toBe(false);
    expect(guard.isAlive(11)).toBe(true);
  });
});
