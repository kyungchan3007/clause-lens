#!/usr/bin/env node
// 복기 참조·체크박스 측정 보고서. 하네스 이식 4/4(#85). 기준선(ClauseLens): 복기 참조율 33%.
//   pnpm metrics                                   이 repo
//   pnpm metrics --repo owner/name [--since 2026-09-01] [--until 2026-09-29]
// 결과에는 수치·날짜·브랜치·이슈 번호만 남긴다(프롬프트·이슈 원문 없음).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listJsonl, projectTranscriptDir } from "../usage/usage.mjs";
import {
  extractFollowups, inPeriod, followupMentioned, pct, PAST_RECORD_RULES, segmentUnits, summarizeIssues, summarizeUnits, toEvents,
} from "./lib.mjs";

const BASELINE_RATE = 0.33; // ClauseLens 기준선(2026-08~09): 첫 수정 전 과거 기록 참조율 33%

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
  return args;
}

function recallSection(project, since, until) {
  const dir = projectTranscriptDir(project);
  const files = listJsonl(dir).filter((f) => !f.includes("/subagents/"));
  if (files.length === 0) return { md: `- 측정 불가: transcript 없음 (\`${dir.replace(/^\/Users\/[^/]+/, "~")}\`)` };
  // 모든 파일의 줄을 합쳐 toEvents를 한 번 — uuid 중복 제거가 파일 경계를 넘게(#45).
  const events = toEvents(files.flatMap((f) => readFileSync(f, "utf8").split("\n"))).filter((e) => (!since || e.ts >= since) && (!until || e.ts < until));
  const units = segmentUnits(events.sort((a, b) => String(a.ts).localeCompare(String(b.ts))));
  const s = summarizeUnits(units);
  const kinds = ["작업 기록", "태스크 문서", "메모리", "git·이슈 이력", "Notion"];
  const md = [
    `- 범위: transcript ${files.length}개 · 작업 시작 단위 ${s.units}개 (도구 사용 ${s.worked}개)`,
    `- **복기 참조율: ${s.referenced} / ${s.worked} (${pct(s.rate)})** · 기준선 ${pct(BASELINE_RATE)} 대비 ${s.rate >= BASELINE_RATE ? "+" : ""}${pct(s.rate - BASELINE_RATE)}`,
    "",
    "| 과거 기록 종류 | 읽은 단위 수 | 읽은 횟수 |",
    "| --- | --- | --- |",
    ...kinds.map((k) => `| ${k} | ${s.kindUnits[k] ?? 0} | ${s.byKind[k] ?? 0} |`),
    "",
    `- 제외: 같은 작업에서 곧 수정할 기록을 읽은 것(쓰려고 읽음) ${s.readToWrite}회`,
    `- **사용자의 체크 수동 지시: ${s.checkRequests}회**`,
    "",
    "<details><summary>단위별 내역</summary>",
    "",
    "| 날짜 | 브랜치 | 요청 | 첫 수정 전 호출 | 과거 기록 읽기 |",
    "| --- | --- | --- | --- | --- |",
    ...units.map((u) => `| ${u.date} | \`${u.branch || "-"}\` | ${u.prompts} | ${u.toolsBeforeEdit}${u.edited ? "" : " (수정 없음)"} | ${Object.entries(u.pastReads).map(([k, n]) => `${k} ${n}`).join(", ") || "없음"} |`),
    "",
    "</details>",
  ];
  return { md: md.join("\n"), summary: s };
}

function issueSection(repo) {
  if (!repo) return { md: "- 측정 안 함: `--repo` 없음" };
  let issues;
  try {
    issues = JSON.parse(execFileSync("gh", ["issue", "list", "-R", repo, "--state", "closed", "--limit", "500", "--json", "number,body"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (error) {
    return { md: `- 측정 불가: gh 이슈 조회 실패 (${String(error.message).split("\n")[0]})` };
  }
  const s = summarizeIssues(issues);
  const md = [
    `- 범위: \`${repo}\` 닫힌 이슈 ${s.issues}개 (체크박스 있는 이슈 ${s.withBoxes}개)`,
    `- **방치된 미체크가 남은 채 닫힌 이슈: ${s.withAbandoned} / ${s.withBoxes}**`,
    "",
    "| 항목 상태 | 개수 | 비율 |",
    "| --- | --- | --- |",
    `| ✅ 체크 | ${s.checked} | ${pct(s.total ? s.checked / s.total : 0)} |`,
    `| ⏭️ 미체크 + 사유 있음 | ${s.reasoned} | ${pct(s.total ? s.reasoned / s.total : 0)} |`,
    `| ⚠️ 미체크 + 사유 없음 (방치) | ${s.abandoned} | **${pct(s.abandonRate)}** |`,
  ];
  return { md: md.join("\n"), summary: s };
}

function followupSection(gitDir, since, until) {
  let log;
  try {
    log = execFileSync("git", ["-C", gitDir, "log", "--reverse", "--format=%cI%x1f%B%x1e"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return { md: "- 측정 불가: git 기록 없음" };
  }
  const all = log.split("\x1e").map((c) => c.trim()).filter(Boolean).map((c) => { const [date, body = ""] = c.split("\x1f"); return { date, body }; });
  const commits = all.map((c) => c.body);
  const tasks = existsSync(join(gitDir, "agents/orchestration/TASKS.md")) ? readFileSync(join(gitDir, "agents/orchestration/TASKS.md"), "utf8") : "";
  // 기간(--since/--until)은 [보완]을 남긴 커밋에만 적용, "이후 언급"은 그 뒤 전체에서 찾는다 (0031)
  const items = all.flatMap((c, i) => (inPeriod(c.date, since, until) ? extractFollowups(c.body).map((item) => ({ item, later: [...commits.slice(i + 1), tasks] })) : []));
  if (items.length === 0) return { md: "- 측정 불가: `[보완]` 형식의 커밋이 없음" };
  const mentioned = items.filter(({ item, later }) => followupMentioned(item, later)).length;
  return { md: `- 커밋 \`[보완]\` 항목 ${items.length}개 중 이후 커밋·TASKS에서 언급 후보 **${mentioned}개 (${pct(mentioned / items.length)})** — 확정은 사람이 확인` };
}

export function report({ project, repo, since, until }) {
  const recall = recallSection(project, since, until);
  const issues = issueSection(repo);
  const follow = followupSection(project, since, until);
  return [
    `# 복기·체크박스 측정 — ${new Date().toISOString().slice(0, 10)}`,
    "",
    `대상: \`${project.replace(/^\/Users\/[^/]+/, "~")}\`${since ? ` · ${since} 이후` : ""}${until ? ` · ${until} 이전` : ""} · 기준선 복기 참조율 ${pct(BASELINE_RATE)}`,
    "",
    "## 1. 복기 참조 (다음 작업이 과거 기록을 보나)",
    "",
    recall.md,
    "",
    "## 2. `[보완]` 반영 (남긴 보완점이 이후에 다뤄지나)",
    "",
    follow.md,
    "",
    "## 3. 이슈 체크박스 (닫을 때 채워져 있나)",
    "",
    issues.md,
    "",
    "## 측정 규칙",
    "",
    "- 작업 시작 단위: 서울 기준 날짜 또는 git 브랜치가 바뀐 첫 사용자 요청",
    "- 맥락 파악 구간: 그 단위에서 첫 수정(Edit·Write·파일을 쓰는 Bash) 전까지의 도구 호출",
    ...PAST_RECORD_RULES.map(([k, re]) => `- ${k}: \`${re.source}\``),
    "- Notion: `notion-fetch|notion-search` 도구",
    "- 쓰려고 읽음: 같은 단위에서 나중에 수정하는 파일·Notion 페이지를 읽은 것은 복기에서 제외",
    "- 사유 있는 미체크: 항목에 `후속|다음|이후|보류|제외|대체|범위 밖|비목표|사유|별도|#숫자|→|TASK-` 포함",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const args = parseArgs(process.argv.slice(2));
  console.log(report({ project: resolve(args.project ?? root), repo: args.repo, since: args.since, until: args.until }));
}
