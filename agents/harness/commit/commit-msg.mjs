#!/usr/bin/env node
// commit-msg 훅 로직 — 작업 브랜치 커밋은 [허점] [보완] [컨텍스트·토큰] 섹션이 있어야 한다. 누락이면 exit 1로 거부.
// .githooks/commit-msg 셸 심이 이 파일을 호출한다 (인자: 커밋 메시지 파일 경로).
import { readFileSync } from "node:fs";
import { currentBranch, isWorkBranch } from "../lib/records.mjs";
import { checkMessage, GUIDE } from "./message.mjs";

let problems = [];
try {
  if (isWorkBranch(currentBranch(process.cwd()))) problems = checkMessage(readFileSync(process.argv[2], "utf8"));
} catch (error) {
  process.stderr.write(`[commit-msg] 내부 오류(커밋은 계속): ${error.message}\n`);
}
if (problems.length > 0) {
  process.stderr.write(`\n[커밋 거부] ${problems.join(" / ")}\n${GUIDE}\n\n`);
  process.exit(1);
}
