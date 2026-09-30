#!/usr/bin/env node
// 현재 브랜치가 spec의 GitHub 이슈에 실제로 연결됐는지 확인 (네트워크 필요 → 게이트 밖, PR 전에 실행).
//   pnpm issue-link
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { branchIssueNumber, currentBranch, issueNumberOf, readSpec, specForIssue } from "../lib/records.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fail = (msg) => {
  console.log(`  ❌ ${msg}`);
  process.exit(1);
};

const branch = currentBranch(root);
const issue = branchIssueNumber(branch);
if (!issue) {
  fail(`브랜치명에 이슈 번호가 없습니다: ${branch || "알 수 없음"} (예: chore/82-슬러그). gh issue develop <번호> --name <접두사>/<번호>-슬러그 로 만드세요`);
}

// spec 연결 확인(선택) — 이슈를 가리키는 spec이 있으면 더블 체크
const specName = specForIssue(root, issue);
if (specName) {
  const specIssue = issueNumberOf(readSpec(root, specName));
  if (specIssue !== issue) fail(`spec ${specName}의 이슈(#${specIssue})와 브랜치 이슈(#${issue})가 다릅니다`);
}

let linked;
try {
  linked = execFileSync("gh", ["issue", "develop", "--list", issue], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  fail(`gh로 이슈 #${issue} 연결 브랜치를 조회하지 못했습니다: ${String(error.message).split("\n")[0]}`);
}
const branches = linked.split("\n").map((l) => l.split("\t")[0].trim()).filter(Boolean);
if (!branches.includes(branch)) {
  fail(`브랜치 ${branch}가 이슈 #${issue}에 연결돼 있지 않습니다 (연결된 브랜치: ${branches.join(", ") || "없음"}). gh issue develop ${issue} --name ${branch} 로 만들었는지 확인하세요`);
}
console.log(`  ✅ ${branch} ↔ 이슈 #${issue} 연결됨${specName ? ` (spec ${specName})` : ""}`);
