#!/usr/bin/env node
// 게이트: 이슈·체크박스 기록 검사 (오프라인 — 네트워크 없음).
// (a) 0023+ spec에 이슈 번호 필수  (b) done 태스크의 연결 spec에 사유 없는 미체크 금지
// 네트워크 연결(브랜치↔이슈)·체크박스 동기화는 pnpm issue-link / issue-sync 참조.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectIssueRecords, listSpecs } from "../lib/records.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const problems = inspectIssueRecords(root);

if (problems.length > 0) {
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`  spec ${listSpecs(root).length}개 · 이슈 번호·done 체크박스 기록 OK`);
