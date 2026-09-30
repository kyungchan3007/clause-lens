import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptanceSection,
  branchIssueNumber,
  doneSpecIds,
  issueNumberOf,
  parseChecklist,
  parseTaskRows,
  specId,
} from "./records.mjs";

test("issueNumberOf — 관련 태스크·이슈 두 형식 모두 인식", () => {
  assert.equal(issueNumberOf("> **관련 태스크**: #82 (chore) · 상태: x"), "82");
  assert.equal(issueNumberOf("- **이슈:** #77"), "77");
  assert.equal(issueNumberOf("> **관련 태스크**: #63 (TASK-003) · 상태"), "63");
});

test("issueNumberOf — 이슈 번호 없으면 undefined", () => {
  assert.equal(issueNumberOf("> **관련 태스크**: TASK-004 (4b) · 상태"), undefined);
  assert.equal(issueNumberOf("아무 내용"), undefined);
  assert.equal(issueNumberOf(""), undefined);
});

test("branchIssueNumber — 접두사 다양, 숫자는 이슈 번호", () => {
  assert.equal(branchIssueNumber("chore/82-issue-checkbox"), "82");
  assert.equal(branchIssueNumber("docs/77-branch-rule"), "77");
  assert.equal(branchIssueNumber("feat/12-thing"), "12");
  assert.equal(branchIssueNumber("fix/34-bug"), "34");
});

test("branchIssueNumber — 번호 없는 레거시 브랜치는 undefined", () => {
  assert.equal(branchIssueNumber("task/4b-result-highlight"), undefined);
  assert.equal(branchIssueNumber("develop"), undefined);
  assert.equal(branchIssueNumber(""), undefined);
});

test("acceptanceSection — spec ### Acceptance", () => {
  const spec = "# 0023\n\n### Acceptance\n- [x] 하나\n- [ ] 둘\n\n## SDD\n- [ ] 안잡힘\n";
  const items = parseChecklist(acceptanceSection(spec));
  assert.deepEqual(items.map((i) => i.text), ["하나", "둘"]);
});

test("acceptanceSection — 이슈 ## 완료 조건", () => {
  const issue = "## 요약\n텍스트\n## 완료 조건\n- [ ] 가\n- [x] 나\n## 예상 허점\n- [ ] 안잡힘\n";
  const items = parseChecklist(acceptanceSection(issue));
  assert.deepEqual(items.map((i) => i.text), ["가", "나"]);
});

test("acceptanceSection — ## Acceptance Criteria(0001형)도 인식", () => {
  const spec = "## Acceptance Criteria\n- [ ] A\n---\n";
  assert.deepEqual(parseChecklist(acceptanceSection(spec)).map((i) => i.text), ["A"]);
});

test("parseChecklist — 체크/사유 판정", () => {
  const items = parseChecklist(
    ["- [x] 완료", "- [ ] 그냥 미체크", "- [ ] 후속 처리", "- [ ] 나중에 (#74)", "- [X] 대문자체크"].join("\n"),
  );
  assert.deepEqual(
    items.map((i) => [i.checked, i.reasoned]),
    [
      [true, false],
      [false, false],
      [false, true], // 미체크 + 사유(후속)
      [false, true], // 미체크 + 사유(#74)
      [true, false],
    ],
  );
});

test("parseTaskRows·doneSpecIds — done 행의 spec만", () => {
  const tasks = [
    "| id | 제목 | 정의 | spec | owner | status | depends |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| TASK-001 | 캡처 | [f](x) | [0001](../intent/specs/0001-a.md) | Claude | **done** | – |",
    "| TASK-004 | OCR | [f](x) | [0021](../intent/specs/0021-b.md)·[0022](../intent/specs/0022-c.md) | Claude | **in-progress** (4a done) | TASK-003 |",
    "| TASK-005 | 로그인 | [f](x) | [0009](../intent/specs/0009-d.md) | Claude | **in-progress** (#36 로그인 done) | #32 |",
  ].join("\n");
  const rows = parseTaskRows(tasks);
  assert.equal(rows.find((r) => r.id === "TASK-001").status, "done");
  assert.equal(rows.find((r) => r.id === "TASK-004").status, "in-progress");
  assert.equal(rows.find((r) => r.id === "TASK-005").status, "in-progress"); // 노트의 "done"에 속지 않음
  assert.deepEqual(doneSpecIds(tasks), ["0001"]);
});

test("specId — 앞 4자리", () => {
  assert.equal(specId("0023-issue-checkbox-enforcement.md"), "0023");
});
