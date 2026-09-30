#!/usr/bin/env node
// prepare-commit-msg 훅 로직 — 작업 브랜치 커밋에 [컨텍스트·토큰]이 없으면 pnpm usage 결과를 자동으로 넣는다.
// 실패해도 커밋은 막지 않는다. .githooks/prepare-commit-msg 셸 심이 호출한다 (인자: 파일 경로, source, sha).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { currentBranch, isWorkBranch } from "../lib/records.mjs";
import { insertSection, isExempt } from "./message.mjs";

const [file, source] = process.argv.slice(2);
try {
  const root = process.cwd();
  if (!isWorkBranch(currentBranch(root)) || ["merge", "squash"].includes(source)) process.exit(0);
  const message = readFileSync(file, "utf8");
  if (isExempt(message)) process.exit(0);
  const section = execFileSync("node", ["agents/harness/usage/usage.mjs", "--commit"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  writeFileSync(file, insertSection(message, section));
} catch (error) {
  process.stderr.write(`[prepare-commit-msg] 토큰 자동 기입 실패(커밋은 계속): ${error.message}\n`);
}
