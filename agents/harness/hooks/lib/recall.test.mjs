import assert from "node:assert/strict";
import { test } from "node:test";
import { pendingFollowups, recentJournal, renderRecap, shouldInject } from "./recall.mjs";

test("pendingFollowups — 이후에 언급 안 된 [보완]만, 최신부터", () => {
  const commits = [
    { subject: "feat: A", body: "[보완]\n- CI 검사 추가\n- 무관한 항목 하나" },
    { subject: "feat: B", body: "나중에 CI에서 검사를 추가했다" }, // A의 "CI 검사"를 언급
  ];
  const out = pendingFollowups(commits, "");
  assert.ok(out.some((f) => f.item.includes("무관한 항목")));
  assert.ok(!out.some((f) => f.item.includes("CI 검사 추가"))); // 언급돼 제외
});

test("recentJournal — ClauseLens 섹션 형식 파싱 (최신 위)", () => {
  const journal = [
    "# 저널",
    "---",
    "## 2026-09-30 · Claude · 최신 작업 (TASK-H4, #85)",
    "- **무엇**: 복기 주입",
    "- **다음/주의**: 효과 측정은 후속",
    "## 2026-09-29 · Claude · 이전 작업",
    "- **무엇**: x",
    "- **다음**: 다음 할 일 y",
  ].join("\n");
  const r = recentJournal(journal, 2);
  assert.equal(r.length, 2);
  assert.equal(r[0].date, "2026-09-30");
  assert.match(r[0].task, /최신 작업/);
  assert.match(r[0].gap, /효과 측정은 후속/);
  assert.equal(r[1].date, "2026-09-29");
  assert.match(r[1].gap, /다음 할 일 y/);
});

test("renderRecap — 1500자 제한 + 항목 표시", () => {
  const out = renderRecap({
    followups: [{ item: "CI 검사", from: "feat: A" }],
    journal: [{ date: "2026-09-30", task: "복기 주입", gap: "측정 후속" }],
    status: "[기록 규칙] 현재 브랜치: chore/85-x",
  });
  assert.match(out, /미처리 \[보완\]/);
  assert.match(out, /CI 검사/);
  assert.match(out, /최근 작업 일지/);
  assert.match(out, /현재 브랜치/);
  assert.ok(out.length <= 1500);
});

test("shouldInject — 날짜·브랜치 바뀐 첫 요청에만", () => {
  const state = { s1: { date: "2026-09-30", branch: "chore/85-x" } };
  assert.equal(shouldInject(state, "s1", "2026-09-30", "chore/85-x"), false); // 같음 → 안 함
  assert.equal(shouldInject(state, "s1", "2026-10-01", "chore/85-x"), true); // 날짜 변경
  assert.equal(shouldInject(state, "s1", "2026-09-30", "chore/86-y"), true); // 브랜치 변경
  assert.equal(shouldInject(state, "s2", "2026-09-30", "chore/85-x"), true); // 새 대화
});
