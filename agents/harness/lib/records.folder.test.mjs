import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  acceptanceSourceForIssue,
  checkFolderPrd,
  checkFolderSdd,
  checkFolderTrace,
  decideEdit,
  folderForIssue,
  inspectIssueRecords,
  inspectSpecReadiness,
  inspectTaskFolder,
  isRecordPath,
  isResidualAutoTraceFolder,
  listTaskFolders,
} from "./records.mjs";

function tmpProject() {
  const root = mkdtempSync(join(tmpdir(), "cl-rec-"));
  mkdirSync(join(root, "agents/intent/specs"), { recursive: true });
  mkdirSync(join(root, "agents/orchestration"), { recursive: true });
  return root;
}
function writeFolder(root, folder, files) {
  const dir = join(root, "agents/intent/specs", folder);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
}

test("isRecordPath — 기록 경로만 허용", () => {
  assert.ok(isRecordPath("agents/intent/specs/0025-x/prd.md"));
  assert.ok(isRecordPath("agents/orchestration/TASKS.md"));
  assert.ok(isRecordPath("agents/JOURNAL.md"));
  assert.ok(!isRecordPath("apps/mobile/app/index.tsx"));
  assert.ok(!isRecordPath("agents/harness/lib/records.mjs"));
});

test("listTaskFolders·folderForIssue", () => {
  const root = tmpProject();
  writeFolder(root, "0025-a", { "prd.md": "# 0025 — a\n> **이슈:** #84\n## Acceptance\n- [ ] x\n" });
  writeFolder(root, "0026-b", { "prd.md": "# 0026 — b\n> **관련 태스크**: #90\n" });
  assert.deepEqual(listTaskFolders(root), ["0025-a", "0026-b"]);
  assert.equal(folderForIssue(root, "84"), "0025-a");
  assert.equal(folderForIssue(root, "90"), "0026-b");
  assert.equal(folderForIssue(root, "999"), undefined);
});

test("acceptanceSourceForIssue — 폴더형 spec을 찾고 prd.md를 원본으로 (#153 결함1)", () => {
  const root = tmpProject();
  writeFolder(root, "0057-folder-spec-sync", {
    "prd.md": "# 0057 — 동기화\n- **이슈:** #153\n### Acceptance\n- [x] 끝낸 것\n- [ ] 남은 것 (후속)\n",
  });
  const src = acceptanceSourceForIssue(root, "153");
  assert.equal(src.kind, "folder");
  assert.equal(src.name, "0057-folder-spec-sync/prd.md");
  assert.match(src.text, /끝낸 것/);
  assert.equal(acceptanceSourceForIssue(root, "999"), undefined);
});

test("acceptanceSourceForIssue — 단일 파일 spec 유지 (회귀)", () => {
  const root = tmpProject();
  writeFileSync(
    join(root, "agents/intent/specs/0023-x.md"),
    "# 0023\n> **관련 태스크**: #40\n### Acceptance\n- [ ] 할 것\n",
  );
  const src = acceptanceSourceForIssue(root, "40");
  assert.equal(src.kind, "file");
  assert.equal(src.name, "0023-x.md");
  assert.match(src.text, /할 것/);
});

test("inspectIssueRecords — 폴더형 spec의 done 미체크도 검사 (#153 결함2)", () => {
  const root = tmpProject();
  writeFolder(root, "0057-folder-spec-sync", {
    "prd.md": "# 0057 — 동기화\n- **이슈:** #153\n### Acceptance\n- [ ] 그냥 빠뜨린 항목\n",
  });
  writeFileSync(
    join(root, "agents/orchestration/TASKS.md"),
    "| TASK-A | x | y | [0057](../intent/specs/0057-folder-spec-sync/) | Claude | **done** | - |\n",
  );
  const problems = inspectIssueRecords(root);
  assert.ok(problems.some((p) => /0057-folder-spec-sync\/prd\.md.*사유 없이 미체크/.test(p)));
});

test("inspectIssueRecords — 단일 파일 spec done 미체크 검사 유지 (회귀)", () => {
  const root = tmpProject();
  writeFileSync(
    join(root, "agents/intent/specs/0023-x.md"),
    "# 0023\n> **관련 태스크**: #40\n### Acceptance\n- [ ] 그냥 빠뜨린 항목\n",
  );
  writeFileSync(
    join(root, "agents/orchestration/TASKS.md"),
    "| TASK-A | x | y | [0023](../intent/specs/0023-x.md) | Claude | **done** | - |\n",
  );
  const problems = inspectIssueRecords(root);
  assert.ok(problems.some((p) => /0023-x\.md.*사유 없이 미체크/.test(p)));
});

test("inspectIssueRecords — 사유 있는 미체크·체크는 통과 (폴더형)", () => {
  const root = tmpProject();
  writeFolder(root, "0057-folder-spec-sync", {
    "prd.md": "# 0057 — 동기화\n- **이슈:** #153\n### Acceptance\n- [x] 끝낸 것\n- [ ] 남은 것 (후속 #200)\n",
  });
  writeFileSync(
    join(root, "agents/orchestration/TASKS.md"),
    "| TASK-A | x | y | [0057](../intent/specs/0057-folder-spec-sync/) | Claude | **done** | - |\n",
  );
  assert.ok(!inspectIssueRecords(root).some((p) => /사유 없이 미체크/.test(p)));
});

test("checkFolderPrd — 제목 잔재·체크박스·이슈번호", () => {
  assert.deepEqual(checkFolderPrd("# 0025 — 실제 제목\n> **이슈:** #84\n## Acceptance\n- [ ] 할 것\n", "0025"), []);
  const p = checkFolderPrd("# NNNN — <태스크 제목> — PRD\n## Acceptance\n- 없음\n", "0025");
  assert.ok(p.some((x) => x.includes("제목")));
  assert.ok(p.some((x) => x.includes("체크박스")));
  assert.ok(p.some((x) => x.includes("이슈")));
});

test("inspectSpecReadiness — PR 시점 spec 준비성(#183 B'/#116, TASKS 비의존)", () => {
  const root = tmpProject();
  // 사유 없는 미체크 → 실패(TASKS 행이 전혀 없어도 잡힘 = #116 갭)
  writeFolder(root, "0100-a", { "prd.md": "# 0100 — a\n- **이슈:** #900\n## Acceptance\n- [x] 한 것\n- [ ] 방치\n" });
  const bad = inspectSpecReadiness(root, "900");
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "abandoned");
  // 전부 체크 또는 사유 있는 미체크 → 통과
  writeFolder(root, "0101-b", { "prd.md": "# 0101 — b\n- **이슈:** #901\n## Acceptance\n- [x] 한 것\n- [ ] 머지 후 검증 — #901\n" });
  assert.equal(inspectSpecReadiness(root, "901").ok, true);
  // spec 없음
  assert.equal(inspectSpecReadiness(root, "999").code, "no_spec");
  // 체크박스 0개
  writeFolder(root, "0102-c", { "prd.md": "# 0102 — c\n- **이슈:** #902\n## Acceptance\n내용 없음\n" });
  assert.equal(inspectSpecReadiness(root, "902").code, "no_checkbox");
});

test("checkFolderSdd·checkFolderTrace", () => {
  assert.deepEqual(checkFolderSdd("## 접근\nx\n## 대안\ny\n## 검증\nz"), []);
  assert.ok(checkFolderSdd("접근만 있음").length >= 1);
  assert.deepEqual(checkFolderTrace("## 판단\n- 실제로 이런 판단을 했다 길게"), []);
  assert.equal(checkFolderTrace("# 제목\n> 안내문\n## 판단\n-").length, 1); // 템플릿만
});

test("inspectTaskFolder — prd·sdd·trace 다 있으면 통과", () => {
  const root = tmpProject();
  writeFolder(root, "0025-a", {
    "prd.md": "# 0025 — a\n> **이슈:** #84\n## Acceptance\n- [ ] 할 것\n",
    "sdd.md": "## 접근\nx\n## 대안\ny\n## 검증\nz\n",
    "trace.md": "## 판단\n- 실제 판단을 충분히 길게 적었다\n",
  });
  writeFileSync(join(root, "agents/orchestration/TASKS.md"), "| TASK-H3 | x | y | [0025](../intent/specs/0025-a/) | Claude | in-progress | - |\n");
  assert.deepEqual(inspectTaskFolder(root, "0025-a"), []);
});

test("inspectTaskFolder — done인데 사유 없는 미체크 차단", () => {
  const root = tmpProject();
  writeFolder(root, "0025-a", {
    "prd.md": "# 0025 — a\n> **이슈:** #84\n## Acceptance\n- [ ] 안 한 것\n",
    "sdd.md": "## 접근\nx\n## 대안\ny\n## 검증\nz\n",
    "trace.md": "## 판단\n- 충분히 긴 실제 판단 기록\n",
  });
  writeFileSync(join(root, "agents/orchestration/TASKS.md"), "| TASK-H3 | x | y | [0025](../intent/specs/0025-a/) | Claude | **done** | - |\n");
  assert.ok(inspectTaskFolder(root, "0025-a").some((p) => p.includes("사유 없이 미체크")));
});

// ── #154: 브랜치 전환 잔재 폴더 건너뛰기(B안) ──────────────────
function gitInit(root) {
  const run = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
  run("init");
  run("config", "user.email", "t@t");
  run("config", "user.name", "t");
}

test("isResidualAutoTraceFolder — 미추적 trace.auto.jsonl만 있는 폴더는 잔재로 판정(건너뜀)", () => {
  const root = tmpProject();
  gitInit(root);
  writeFolder(root, "0042-x", { "trace.auto.jsonl": '{"ts":"1"}\n' }); // 미추적
  assert.equal(isResidualAutoTraceFolder(root, "0042-x"), true);
});

test("isResidualAutoTraceFolder — prd/sdd 없이 '추적'되는 파일이 있으면 잔재 아님(여전히 FAIL, 회귀)", () => {
  const root = tmpProject();
  gitInit(root);
  writeFolder(root, "0043-y", { "notes.md": "작업 중\n" });
  execFileSync("git", ["-C", root, "add", "agents/intent/specs/0043-y/notes.md"], { stdio: "ignore" });
  assert.equal(isResidualAutoTraceFolder(root, "0043-y"), false);
  // 잔재가 아니므로 inspectTaskFolder가 prd/sdd/trace 누락을 그대로 잡는다
  const problems = inspectTaskFolder(root, "0043-y");
  assert.ok(problems.some((p) => p.includes("prd.md")));
});

test("isResidualAutoTraceFolder — prd가 있으면(작업 중 폴더) 잔재 아님 → 진짜 누락 유지", () => {
  const root = tmpProject();
  writeFolder(root, "0044-z", { "prd.md": "# 0044\n> **이슈:** #300\n## Acceptance\n- [ ] x\n" });
  assert.equal(isResidualAutoTraceFolder(root, "0044-z"), false);
  assert.ok(inspectTaskFolder(root, "0044-z").some((p) => p.includes("sdd.md"))); // sdd 누락 여전히 FAIL
});

test("isResidualAutoTraceFolder — 자동기록 외 파일이 섞여 있으면 잔재로 보지 않음(안전)", () => {
  const root = tmpProject();
  gitInit(root);
  writeFolder(root, "0045-w", { "trace.auto.jsonl": "{}\n", "extra.txt": "뭔가\n" });
  assert.equal(isResidualAutoTraceFolder(root, "0045-w"), false);
});

test("isResidualAutoTraceFolder — 비-git 환경은 fail-open(잔재로 보지 않음 → 누락 은닉 방지)", () => {
  const root = tmpProject(); // gitInit 안 함 → git 사용 불가
  writeFolder(root, "0046-v", { "trace.auto.jsonl": '{"ts":"1"}\n' });
  // 추적 여부를 알 수 없으므로 잔재로 단정하지 않는다(false). 게이트가 진짜 누락을 계속 FAIL로 잡음.
  assert.equal(isResidualAutoTraceFolder(root, "0046-v"), false);
  assert.ok(inspectTaskFolder(root, "0046-v").some((p) => p.includes("prd.md")));
});

test("decideEdit — 기록 경로 허용 · 코드 경로는 이슈 브랜치 없으면 차단", () => {
  const root = tmpProject(); // git 아님 → currentBranch ""
  assert.equal(decideEdit(root, "agents/intent/specs/0025-a/prd.md").allow, true);
  const d = decideEdit(root, "apps/mobile/app/index.tsx");
  assert.equal(d.allow, false);
  assert.match(d.reason, /이슈 브랜치/);
});
