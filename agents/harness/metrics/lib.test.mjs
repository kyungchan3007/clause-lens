import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHECK_REQUEST,
  classifyPastRead,
  extractFollowups,
  followupMentioned,
  inPeriod,
  isEdit,
  keywords,
  parseCheckboxes,
  segmentUnits,
  summarizeIssues,
  summarizeUnits,
  toEvents,
  typedText,
} from "./lib.mjs";

// transcript 줄 헬퍼 (harness-lab 테스트 참고)
const user = (ts, text, raw = {}) =>
  JSON.stringify({ type: "user", timestamp: ts, gitBranch: raw.branch ?? "main", message: { content: text }, ...raw });
const tool = (ts, id, name, input, raw = {}) =>
  JSON.stringify({ type: "assistant", timestamp: ts, gitBranch: raw.branch ?? "main", isSidechain: raw.side, message: { content: [{ type: "tool_use", id, name, input }] } });

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

// ── 사용자가 직접 친 요청만 (0031, #184) ──
const checks = (lines) => summarizeUnits(segmentUnits(toEvents(lines))).checkRequests;

test("CHECK_REQUEST — 실제 체크 요청 3종은 센다", () => {
  for (const t of [
    "니가 커밋하고 푸쉬하고 나면 이거 체크를 체워줘여 할거 같은데",
    "여기에 완료 조건이 있던데 이거 체크 안해도 되는거야?",
    "왜 이슈 체크박스는 확인 안해 이거도 지침서에 있지 않아?",
  ]) assert.ok(CHECK_REQUEST.test(t), t);
});

test("CHECK_REQUEST — 체크박스를 언급만 한 문장(붙여넣은 제목)은 세지 않는다", () => {
  assert.equal(CHECK_REQUEST.test("* [fix(harness): 체크박스 동기화·검사가 폴더형 spec(0025~)을 못 찾음 #153](https://x)"), false);
  assert.equal(CHECK_REQUEST.test("체크박스 도구가 단일 파일 가정 → 폴더형 미인식"), false);
});

test("typedText — 셸 입출력·시스템 안내·붙여넣기·명령 태그를 걷어 낸다", () => {
  assert.equal(typedText("<bash-input>bash checks.sh</bash-input><bash-stdout>✔ 체크박스 확인 안 해도 됨</bash-stdout>"), "");
  assert.equal(typedText("<system-reminder>체크해줘</system-reminder>\n좋아"), "좋아");
  assert.equal(typedText('<pasted_content id="1">체크 해줘</pasted_content> 이거 봐줘'), "이거 봐줘");
  assert.equal(typedText("<artifact-content-authored-by-others/>요약"), "요약");
});

test("toEvents — 대화 요약·uuid 중복·태그 제거 후 요청만 센다", () => {
  const lines = [
    user("2026-10-01T01:00:00Z", "이거 체크 안해?", { uuid: "u1" }),
    user("2026-10-01T01:00:00Z", "이거 체크 안해?", { uuid: "u1" }), // 다른 파일에 같은 메시지
    user("2026-10-01T02:00:00Z", "This session is being continued … 체크해줘", { uuid: "u2", isCompactSummary: true }),
    user("2026-10-01T03:00:00Z", "<bash-input>bash checks.sh</bash-input><bash-stdout>체크 해야 함</bash-stdout>", { uuid: "u3" }),
  ];
  assert.equal(checks(lines), 1);
});

test("inPeriod — [since, until), 시간대 없는 시각은 UTC", () => {
  assert.equal(inPeriod("2026-10-02T08:11:00Z", "2026-10-01", "2026-10-02T08:12"), true);
  assert.equal(inPeriod("2026-10-02T08:12:30Z", undefined, "2026-10-02T08:12Z"), false);
  assert.equal(inPeriod("2026-09-30T23:00:00+09:00", "2026-09-30T15:00Z"), false);
});
