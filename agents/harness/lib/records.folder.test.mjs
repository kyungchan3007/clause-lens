import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  checkFolderPrd,
  checkFolderSdd,
  checkFolderTrace,
  decideEdit,
  folderForIssue,
  inspectTaskFolder,
  isRecordPath,
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

test("checkFolderPrd — 제목 잔재·체크박스·이슈번호", () => {
  assert.deepEqual(checkFolderPrd("# 0025 — 실제 제목\n> **이슈:** #84\n## Acceptance\n- [ ] 할 것\n", "0025"), []);
  const p = checkFolderPrd("# NNNN — <태스크 제목> — PRD\n## Acceptance\n- 없음\n", "0025");
  assert.ok(p.some((x) => x.includes("제목")));
  assert.ok(p.some((x) => x.includes("체크박스")));
  assert.ok(p.some((x) => x.includes("이슈")));
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

test("decideEdit — 기록 경로 허용 · 코드 경로는 이슈 브랜치 없으면 차단", () => {
  const root = tmpProject(); // git 아님 → currentBranch ""
  assert.equal(decideEdit(root, "agents/intent/specs/0025-a/prd.md").allow, true);
  const d = decideEdit(root, "apps/mobile/app/index.tsx");
  assert.equal(d.allow, false);
  assert.match(d.reason, /이슈 브랜치/);
});
