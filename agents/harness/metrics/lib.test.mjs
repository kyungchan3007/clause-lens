import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyPastRead,
  extractFollowups,
  followupMentioned,
  isEdit,
  keywords,
  parseCheckboxes,
  segmentUnits,
  summarizeIssues,
  summarizeUnits,
  toEvents,
} from "./lib.mjs";

test("extractFollowups — [보완] 섹션의 불릿만", () => {
  const msg = "feat: x\n\n[허점]\n- h\n\n[보완]\n- CI 검사 추가\n- trace 합류\n\nCo-Authored-By: y\n";
  assert.deepEqual(extractFollowups(msg), ["CI 검사 추가", "trace 합류"]);
  assert.deepEqual(extractFollowups("no section"), []);
});

test("keywords·followupMentioned — 핵심어 2개 모두 등장하면 언급", () => {
  const item = "CI에서 커밋 메시지 세 섹션 검사";
  assert.ok(followupMentioned(item, ["나중에 CI에서 커밋 메시지를 검사하도록 했다"]));
  assert.ok(!followupMentioned(item, ["관련 없는 텍스트"]));
  assert.ok(keywords(item).length <= 2);
});

test("isEdit — 편집 도구·쓰는 Bash", () => {
  assert.ok(isEdit("Edit", {}));
  assert.ok(isEdit("Bash", { command: "echo x > file.txt" }));
  assert.ok(isEdit("Bash", { command: "git commit -m x" }));
  assert.ok(!isEdit("Bash", { command: "cat file.txt" }));
  assert.ok(!isEdit("Read", { file_path: "a" }));
});

test("classifyPastRead — 과거 기록 읽기 분류", () => {
  assert.equal(classifyPastRead("Read", { file_path: "agents/JOURNAL.md" }), "작업 기록");
  assert.equal(classifyPastRead("Read", { file_path: "agents/intent/specs/0025-x/prd.md" }), "태스크 문서");
  assert.equal(classifyPastRead("Bash", { command: "gh issue view 85" }), "git·이슈 이력");
  assert.equal(classifyPastRead("Read", { file_path: "apps/mobile/x.tsx" }), undefined);
  assert.equal(classifyPastRead("Edit", { file_path: "agents/JOURNAL.md" }), undefined); // 수정은 읽기 아님
});

test("segmentUnits·summarizeUnits — 첫 수정 전 과거 기록 읽으면 참조", () => {
  const events = toEvents([
    JSON.stringify({ type: "user", timestamp: "2026-09-30T01:00:00Z", gitBranch: "chore/85-x", message: { content: "작업 시작" } }),
    JSON.stringify({ type: "assistant", timestamp: "2026-09-30T01:01:00Z", gitBranch: "chore/85-x", message: { content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: "agents/JOURNAL.md" } }] } }),
    JSON.stringify({ type: "assistant", timestamp: "2026-09-30T01:02:00Z", gitBranch: "chore/85-x", message: { content: [{ type: "tool_use", id: "t2", name: "Edit", input: { file_path: "apps/x.ts" } }] } }),
  ]);
  const s = summarizeUnits(segmentUnits(events));
  assert.equal(s.worked, 1);
  assert.equal(s.referenced, 1);
  assert.equal(s.rate, 1);
});

test("parseCheckboxes·summarizeIssues — 체크/사유/방치", () => {
  const items = parseCheckboxes("- [x] a\n- [ ] b\n- [ ] c (후속 #1)");
  assert.deepEqual(items.map((i) => [i.checked, i.reasoned]), [[true, false], [false, false], [false, true]]);
  const s = summarizeIssues([{ body: "- [x] a\n- [ ] b\n- [ ] c (후속)" }]);
  assert.equal(s.checked, 1);
  assert.equal(s.reasoned, 1);
  assert.equal(s.abandoned, 1);
});
