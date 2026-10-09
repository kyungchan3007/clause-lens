#!/usr/bin/env node
// 체크박스 단일 관리 — 원본은 spec의 ### Acceptance, 이슈(## 완료 조건)는 복사본.
//   pnpm issue-sync           spec Acceptance로 이슈 체크리스트를 교체
//   pnpm issue-sync --check   이슈와 spec이 어긋나면 exit 1 (수정 안 함)
//   pnpm issue-sync --close   이 브랜치의 PR이 합쳐졌는데 이슈가 열려 있으면 닫음 (사유 없는 미체크가 있으면 거부)
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { acceptanceSection, acceptanceSourceForIssue, branchIssueNumber, currentBranch, parseChecklist } from "../lib/records.mjs";

const norm = (t) => t.replace(/\s+/g, " ").trim();

export function renderChecklist(items) {
  return items.map((i) => `- [${i.checked ? "x" : " "}] ${i.text}`).join("\n");
}

/**
 * 이슈 본문의 "완료 조건"(또는 "Acceptance") 체크리스트를 spec 목록으로 제자리 교체 (다른 섹션은 그대로).
 * 제목은 `## `·`### ` 모두 인식하고, 섹션 끝 경계를 같은 레벨 이하(#{1..level}) 제목 또는 `---`로 잡아
 * 뒤따르는 다른 `###` 섹션(과 그 체크박스)을 삼키지 않는다. (records.mjs acceptanceSection과 동일 규칙)
 */
export function replaceIssueAcceptance(issueBody, specItems) {
  const block = renderChecklist(specItems);
  const head = /^(#{2,3})[ \t]*(?:완료 조건|Acceptance)[^\n]*$/m.exec(issueBody);
  if (!head) return `${issueBody.replace(/\s*$/, "")}\n\n## 완료 조건\n${block}\n`;
  const level = head[1].length;
  const before = issueBody.slice(0, head.index); // 제목 앞 (원형 보존)
  const headingLine = head[0]; // 제목 줄 (개행 없음)
  const body = issueBody.slice(head.index + headingLine.length); // 제목 뒤 (맨 앞 \n 포함)
  const stop = new RegExp(`^#{1,${level}}[ \\t]|^---[ \\t]*$`, "m").exec(body);
  const section = stop ? body.slice(0, stop.index) : body;
  const after = (stop ? body.slice(stop.index) : "").replace(/^\n+/, "");
  // 섹션 안의 체크박스 아닌 줄은 보존 (부가 설명 등)
  const kept = section.split("\n").filter((l) => l.trim() && !/^\s*[-*] \[( |x|X)\] /.test(l)).join("\n").trim();
  const rebuilt = `${headingLine}\n${block}\n${kept ? `${kept}\n` : ""}`;
  return `${before}${rebuilt}${after ? `\n${after}` : ""}`;
}

/** spec과 이슈 체크리스트 비교 → 어긋난 항목 목록 */
export function compareChecklists(specItems, issueItems) {
  const issue = new Map(issueItems.map((i) => [norm(i.text), i.checked]));
  const spec = new Map(specItems.map((i) => [norm(i.text), i.checked]));
  const diffs = [];
  for (const [text, checked] of spec) {
    if (!issue.has(text)) diffs.push(`이슈에 없음: ${text}`);
    else if (issue.get(text) !== checked) diffs.push(`상태 다름 (spec ${checked ? "체크" : "미체크"} / 이슈 ${issue.get(text) ? "체크" : "미체크"}): ${text}`);
  }
  for (const text of issue.keys()) if (!spec.has(text)) diffs.push(`spec에 없음: ${text}`);
  return diffs;
}

/**
 * 순수 코어(#183): 이슈 번호 + 이슈 본문을 받아 spec과 동기화 결과를 계산한다(IO 없음).
 * 호출측이 getBody/putBody/comment를 담당 → CLI(gh)·Action(fetch) 모두 재사용.
 *  - mode "sync"(기본): spec 체크 상태를 이슈로 미러(없는 체크 안 만듦) → nextBody.
 *  - mode "check": spec↔이슈 어긋남(diffs).
 */
export function syncIssueFromSpec({ projectDir, issueNumber, issueBody, mode = "sync" }) {
  const src = acceptanceSourceForIssue(projectDir, issueNumber);
  if (!src) return { ok: false, code: "no_spec", message: `이슈 #${issueNumber}를 가리키는 spec이 없습니다` };
  const specItems = parseChecklist(acceptanceSection(src.text));
  if (specItems.length === 0) return { ok: false, code: "no_checkbox", specName: src.name, message: `${src.name}의 Acceptance에 체크박스가 없습니다` };
  const checked = specItems.filter((i) => i.checked).length;
  const base = { specName: src.name, checked, total: specItems.length };
  if (mode === "check") {
    const diffs = compareChecklists(specItems, parseChecklist(acceptanceSection(issueBody ?? "")));
    return { ok: diffs.length === 0, code: diffs.length ? "drift" : "ok", diffs, ...base };
  }
  const nextBody = replaceIssueAcceptance(issueBody ?? "", specItems);
  return { ok: true, code: nextBody === (issueBody ?? "") ? "unchanged" : "updated", nextBody, ...base };
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const argv = process.argv.slice(2);
  const mode = argv.includes("--check") ? "--check" : argv.includes("--close") ? "--close" : "--sync";
  const issueArg = argv.indexOf("--issue");
  const issueOverride = issueArg >= 0 ? argv[issueArg + 1] : undefined; // 임의 이슈 지정(머지 후 정정·CI)
  const fail = (msg) => {
    console.log(`  ❌ ${msg}`);
    process.exit(1);
  };
  const branch = currentBranch(root);
  const issue = issueOverride ?? branchIssueNumber(branch);
  if (!issue) fail(`이슈 번호가 없습니다 (브랜치 ${branch} 또는 --issue N)`);
  const { body, state } = JSON.parse(gh(["issue", "view", issue, "--json", "body,state"]));

  if (mode === "--close") {
    // 닫기는 브랜치 기준(PR 머지 확인) — 순수 코어는 상태 미러만 담당.
    const src = acceptanceSourceForIssue(root, issue);
    if (!src) fail(`이슈 #${issue}를 가리키는 spec이 없습니다`);
    const specItems = parseChecklist(acceptanceSection(src.text));
    if (specItems.length === 0) fail(`${src.name}의 Acceptance에 체크박스가 없습니다`);
    const abandoned = specItems.filter((i) => !i.checked && !i.reasoned);
    if (abandoned.length) fail(`사유 없는 미체크가 ${abandoned.length}개 있어 닫지 않습니다: ${abandoned.map((i) => i.text).join(" / ")}`);
    const prs = JSON.parse(gh(["pr", "list", "--head", branch, "--state", "merged", "--json", "number"]));
    if (!prs.length) fail(`브랜치 ${branch}의 합쳐진 PR이 없습니다`);
    if (state === "CLOSED") console.log(`  ✅ 이슈 #${issue}는 이미 닫혀 있음`);
    else {
      gh(["issue", "close", issue, "--comment", `PR #${prs[0].number} 합쳐짐 — 완료 조건 ${specItems.filter((i) => i.checked).length}/${specItems.length} (pnpm issue-sync --close)`]);
      console.log(`  ✅ 이슈 #${issue} 닫음 (PR #${prs[0].number} 합쳐짐, 자동으로 닫히지 않았던 경우)`);
    }
    process.exit(0);
  }

  const r = syncIssueFromSpec({ projectDir: root, issueNumber: issue, issueBody: body, mode: mode === "--check" ? "check" : "sync" });
  if (r.code === "no_spec" || r.code === "no_checkbox") fail(r.message);
  if (mode === "--check") {
    if (!r.ok) fail(`이슈 #${issue}와 spec이 어긋남:\n${r.diffs.map((d) => `     - ${d}`).join("\n")}\n     → pnpm issue-sync 로 맞추세요`);
    console.log(`  ✅ 이슈 #${issue} ↔ ${r.specName} 체크박스 일치 (${r.checked}/${r.total} 체크)`);
  } else if (r.code === "unchanged") {
    console.log(`  ✅ 이슈 #${issue} 이미 spec과 같음`);
  } else {
    const file = join(mkdtempSync(join(tmpdir(), "issue-sync-")), "body.md");
    writeFileSync(file, r.nextBody);
    gh(["issue", "edit", issue, "--body-file", file]);
    console.log(`  ✅ 이슈 #${issue} 체크리스트를 ${r.specName}에 맞춤 (${r.checked}/${r.total} 체크)`);
  }
}
