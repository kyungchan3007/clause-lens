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
  // 스킵은 "조용한 PASS"가 아니다: isResidualAutoTraceFolder가 ① prd/sdd/trace 全無
  // ② 폴더 안이 자동기록(trace.auto류)뿐 ③ git에서 미추적 임을 모두 확인했을 때만 true.
  //   - 비-git·git 오류면 fail-open(false) → 아래 inspectTaskFolder가 누락을 FAIL로 잡음.
  //   - 추적되는 파일이 있으면 false → 역시 FAIL. 즉 진짜 누락이 PASS로 새지 않는다.
  // 그럼에도 스킵 사실·근거를 stderr(console.warn)로 남겨 CI 로그에서 눈에 띄게 한다
  // (console.log/stdout은 요약에 묻힐 수 있어 warn 사용).
  if (isResidualAutoTraceFolder(root, folder)) {
    console.warn(
      `  ⚠️ (skip) ${SPECS_DIR}/${folder}: 브랜치 전환 잔재로 판정해 검사 제외 ` +
        `(근거: prd/sdd/trace 없음 + 미추적 trace.auto류뿐, git 확인) — #154`,
    );
    continue;
  }
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
