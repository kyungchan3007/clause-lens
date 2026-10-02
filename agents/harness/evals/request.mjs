#!/usr/bin/env node
// 원문 고정(#155): 이슈 본문을 태스크 폴더의 request.md로 1회 복사한다(덮어쓰지 않음).
// - 자르는 기준 = 전체 복사(설계: 0059 sdd/trace). ClauseLens 이슈엔 회고 섹션이 없고
//   `---`가 본문 구분자로 쓰여 추정 절단은 요구사항 유실 위험이 있어 자르지 않는다.
// - 한 번 생성된 request.md는 불변(가드가 수정 차단) — 이 도구도 기존 파일을 덮어쓰지 않는다.
// 사용: pnpm request <이슈번호>
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { folderForIssue, SPECS_DIR } from "../lib/records.mjs";

export const REQUEST_FILE = "request.md";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** 원문 파일 내용(순수) — 헤더(메타·불변 주석) + 구분선 + 이슈 본문 전체. */
export function buildRequestContent({ issue, body, url, capturedAt }) {
  const normalized = String(body ?? "").replace(/\r\n/g, "\n").trimEnd();
  const header = [
    "<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->",
    `# 원문 — 이슈 #${issue}`,
    "",
    `- 이슈: ${url || `#${issue}`}`,
    `- 캡처: ${capturedAt}`,
    "",
    "---",
    "",
  ].join("\n");
  return `${header}${normalized}\n`;
}

/** 이미 있으면 덮어쓰지 않는다(불변 원문 보호). */
export function writeRequestOnce(path, content) {
  if (existsSync(path)) return { created: false, path };
  writeFileSync(path, content, "utf8");
  return { created: true, path };
}

/** gh로 이슈 본문·URL 조회(네트워크). */
function fetchIssue(issue) {
  const out = execFileSync("gh", ["issue", "view", String(issue), "--json", "body,url"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const json = JSON.parse(out);
  return { body: json.body ?? "", url: json.url ?? "" };
}

function main() {
  const issue = (process.argv[2] || "").replace(/^#/, "");
  if (!/^\d+$/.test(issue)) {
    console.error("사용법: pnpm request <이슈번호>  (예: pnpm request 155)");
    process.exit(1);
  }
  const folder = folderForIssue(ROOT, issue);
  if (!folder) {
    console.error(
      `이슈 #${issue}의 spec 폴더가 없습니다. 먼저 폴더형 spec을 만드세요:\n` +
        `  ${SPECS_DIR}/<번호>-슬러그/prd.md 에 "- **이슈:** #${issue}" 포함 (템플릿: agents/intent/templates/).`,
    );
    process.exit(1);
  }
  const path = join(ROOT, SPECS_DIR, folder, REQUEST_FILE);
  const rel = relative(ROOT, path);
  if (existsSync(path)) {
    console.log(`이미 있음(덮어쓰지 않음·불변): ${rel}`);
    return;
  }
  const { body, url } = fetchIssue(issue);
  const content = buildRequestContent({
    issue,
    body,
    url,
    capturedAt: new Date().toISOString().slice(0, 10),
  });
  const res = writeRequestOnce(path, content);
  console.log(res.created ? `생성: ${rel} (이슈 #${issue} 본문 ${body.length}자 복사)` : `이미 있음: ${rel}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
