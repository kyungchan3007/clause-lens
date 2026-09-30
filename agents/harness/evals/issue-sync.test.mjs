import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChecklist } from "../lib/records.mjs";
import { compareChecklists, renderChecklist, replaceIssueAcceptance } from "./issue-sync.mjs";

test("renderChecklist — 체크 상태 반영", () => {
  const out = renderChecklist([
    { text: "가", checked: true },
    { text: "나", checked: false },
  ]);
  assert.equal(out, "- [x] 가\n- [ ] 나");
});

test("replaceIssueAcceptance — 완료 조건 체크리스트만 교체, 다른 섹션 보존", () => {
  const body = "## 요약\n설명\n\n## 완료 조건\n- [ ] 옛날 항목\n부가설명 유지\n\n## 예상 허점\n- 허점\n";
  const specItems = [
    { text: "새 A", checked: true },
    { text: "새 B", checked: false },
  ];
  const next = replaceIssueAcceptance(body, specItems);
  assert.match(next, /## 요약\n설명/);
  assert.match(next, /- \[x\] 새 A\n- \[ \] 새 B/);
  assert.match(next, /부가설명 유지/); // 체크박스 아닌 줄 보존
  assert.match(next, /## 예상 허점\n- 허점/); // 뒤 섹션 보존
  assert.doesNotMatch(next, /옛날 항목/); // 옛 체크박스 제거
});

test("replaceIssueAcceptance — 완료 조건 섹션 없으면 추가", () => {
  const body = "## 요약\n설명만 있음\n";
  const next = replaceIssueAcceptance(body, [{ text: "A", checked: false }]);
  assert.match(next, /## 완료 조건\n- \[ \] A/);
});

test("compareChecklists — 상태·누락 차이 감지", () => {
  const spec = parseChecklist("- [x] 공통\n- [ ] spec만");
  const issue = parseChecklist("- [ ] 공통\n- [ ] 이슈만");
  const diffs = compareChecklists(spec, issue);
  assert.equal(diffs.length, 3);
  assert.ok(diffs.some((d) => /상태 다름.*공통/.test(d)));
  assert.ok(diffs.some((d) => /이슈에 없음: spec만/.test(d)));
  assert.ok(diffs.some((d) => /spec에 없음: 이슈만/.test(d)));
});

test("compareChecklists — 일치하면 빈 배열", () => {
  const a = parseChecklist("- [x] 하나\n- [ ] 둘");
  assert.deepEqual(compareChecklists(a, parseChecklist("- [x] 하나\n- [ ] 둘")), []);
});
