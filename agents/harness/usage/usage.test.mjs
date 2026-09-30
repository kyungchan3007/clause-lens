import assert from "node:assert/strict";
import { test } from "node:test";
import { extractRequests, fmt, projectTranscriptDir, renderSection, summarize } from "./usage.mjs";

const line = (id, branch, usage, extra = {}) =>
  JSON.stringify({
    type: "assistant",
    sessionId: extra.session ?? "s1",
    gitBranch: branch,
    timestamp: extra.ts ?? "2026-09-29T10:00:00Z",
    message: { id, model: "claude-opus-5-5", usage },
  });
const U = (input, cw, cr, out) => ({ input_tokens: input, cache_creation_input_tokens: cw, cache_read_input_tokens: cr, output_tokens: out });

test("같은 message.id(스트리밍 중복)는 한 번만 센다", () => {
  const lines = [line("m1", "chore/83-a", U(1, 10, 100, 5)), line("m1", "chore/83-a", U(1, 10, 100, 5)), line("m2", "chore/83-a", U(2, 0, 200, 7))];
  assert.equal(extractRequests(lines).length, 2);
});

test("브랜치로 걸러 합산, 컨텍스트=입력+캐시읽기+캐시쓰기의 최대·마지막", () => {
  const lines = [
    line("m1", "chore/83-a", U(1, 10, 100, 5), { ts: "2026-09-29T10:00:00Z" }),
    line("m2", "chore/83-a", U(2, 0, 300, 7), { ts: "2026-09-29T10:01:00Z", session: "s2" }),
    line("m3", "develop", U(999, 999, 999, 999)),
    "not json",
    JSON.stringify({ type: "user", message: { content: "hi" } }),
  ];
  const s = summarize(extractRequests(lines, (d) => d.gitBranch === "chore/83-a"));
  assert.deepEqual(
    { requests: s.requests, sessions: s.sessions, input: s.input, cacheWrite: s.cacheWrite, cacheRead: s.cacheRead, output: s.output, maxContext: s.maxContext, lastContext: s.lastContext },
    { requests: 2, sessions: 2, input: 3, cacheWrite: 10, cacheRead: 400, output: 12, maxContext: 302, lastContext: 302 },
  );
});

test("fmt — k·M 단위", () => {
  assert.equal(fmt(1234), "1.2k");
  assert.equal(fmt(2_500_000), "2.50M");
  assert.equal(fmt(42), "42");
});

test("renderSection — 기록 없으면 집계 불가(Codex 커밋)", () => {
  assert.match(renderSection(summarize([]), { scope: "브랜치 x 누적" }), /집계 불가/);
});

test("renderSection — 정상 섹션 렌더", () => {
  const out = renderSection(summarize(extractRequests([line("m1", "b", U(1, 2, 3, 4))])), { scope: "브랜치 b 누적" });
  assert.match(out, /^\[컨텍스트·토큰\]/);
  assert.match(out, /범위: 브랜치 b 누적/);
  assert.match(out, /토큰: 입력/);
});

test("projectTranscriptDir — 경로의 영숫자 외 문자를 -로", () => {
  const dir = projectTranscriptDir("/Users/chan/Documents/develop/clause-lens", "/home");
  assert.equal(dir, "/home/.claude/projects/-Users-chan-Documents-develop-clause-lens");
});
