#!/usr/bin/env node
// 게이트: 폴더형 spec 기록 검사 (하네스 이식 3/4, #84) — 오프라인.
// - 0025부터 spec은 폴더(prd·sdd·trace) 필수, 단일 파일 금지 (0001~0024는 면제)
// - 폴더 spec: prd·sdd·trace 실제 내용 + done 미체크(사유無) 금지
// - 현재 이슈 브랜치의 spec(파일 또는 폴더)이 있어야 함
// 이슈 번호·단일 파일 done 검사는 check-issue-records.mjs 참조.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  branchIssueNumber,
  currentBranch,
  FOLDER_REQUIRED_FROM,
  folderForIssue,
  inspectTaskFolder,
  isResidualAutoTraceFolder,
  listSpecs,
  listTaskFolders,
  specForIssue,
  specId,
  SPECS_DIR,
} from "../lib/records.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const problems = [];

for (const name of listSpecs(root)) {
  if (specId(name) >= FOLDER_REQUIRED_FROM) {
    problems.push(`${SPECS_DIR}/${name}: ${FOLDER_REQUIRED_FROM}부터는 단일 파일이 아니라 폴더 spec(prd·sdd·trace)이어야 합니다`);
  }
}

for (const folder of listTaskFolders(root)) {
  // 브랜치 전환 잔재(미추적 trace.auto.jsonl류만 있는 폴더)는 오탐이므로 건너뜀 (#154).
  // 진짜 누락(prd/sdd 없이 작업 중·추적 파일 있는 폴더)은 아래에서 그대로 FAIL.
  if (isResidualAutoTraceFolder(root, folder)) continue;
  problems.push(...inspectTaskFolder(root, folder).map((p) => `${folder}: ${p}`));
}

const branch = currentBranch(root);
const issue = branchIssueNumber(branch);
if (issue && !specForIssue(root, issue) && !folderForIssue(root, issue)) {
  problems.push(`브랜치 ${branch}(이슈 #${issue})의 spec이 없습니다 — ${SPECS_DIR}/<번호>-슬러그/ 폴더에 prd·sdd·trace 작성`);
}

if (problems.length > 0) {
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`  폴더 spec ${listTaskFolders(root).length}개 · 기록 OK${issue ? ` · 현재 이슈 #${issue}` : ""}`);
