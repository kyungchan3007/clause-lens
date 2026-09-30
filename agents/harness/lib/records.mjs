// 이슈·체크박스 기록 판정 — 게이트(check-issue-records)와 네트워크 명령(issue-link·issue-sync)이 공유.
// harness-lab에서 발췌·적응(폴더형·역할·trace 제외). ClauseLens는 단일 파일 spec + base=develop.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SPECS_DIR = "agents/intent/specs";
export const TASKS_FILE = "agents/orchestration/TASKS.md";

// 이 번호부터 spec에 GitHub 이슈 번호가 필수 (0001~0022는 이슈 도입 전이라 면제)
export const ISSUE_REQUIRED_FROM = "0023";

// 브랜치 접두사(성격)는 다양하고, 뒤 숫자 = GitHub 이슈 번호 (예: chore/82-슬러그)
const BRANCH_ISSUE = /^(?:task|fix|chore|docs|feat|feature|refactor|style|deploy)\/(\d+)-/;

// spec·이슈에서 이슈 번호를 담는 줄 (둘 다 인식): "> **관련 태스크**: … #82" | "- **이슈:** #82"
const ISSUE_LINE = /^\s*(?:>\s*)?(?:[-*]\s*)?\*\*(?:관련 태스크|이슈):?\*\*\s*:?[^\n]*?#(\d+)/m;

// 미체크에 이 표지가 있으면 "사유 있는 미체크"(후속으로 넘김 등)
export const REASON_MARK = /후속|다음|이후|보류|제외|대체|범위 밖|비목표|사유|별도|#\d+|→|TASK-/;

export function git(projectDir, args) {
  try {
    return execFileSync("git", ["-C", projectDir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function currentBranch(projectDir) {
  return (
    process.env.GITHUB_HEAD_REF ||
    git(projectDir, ["symbolic-ref", "--short", "HEAD"]) ||
    git(projectDir, ["rev-parse", "--abbrev-ref", "HEAD"])
  );
}

/** 브랜치명에서 이슈 번호 (없으면 undefined) */
export function branchIssueNumber(branch) {
  return BRANCH_ISSUE.exec(branch ?? "")?.[1];
}

/** 작업 브랜치인지(접두사/이슈번호- 규칙). 커밋 규칙·토큰 집계가 적용될 브랜치. */
export function isWorkBranch(branch) {
  return branchIssueNumber(branch) !== undefined;
}

// ── spec (단일 파일 NNNN-슬러그.md) ─────────────────────────────

export function listSpecs(projectDir) {
  const dir = join(projectDir, SPECS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^\d{4}-.*\.md$/.test(n))
    .sort();
}

export function specId(name) {
  return (name ?? "").slice(0, 4);
}

export function readSpec(projectDir, name) {
  const p = join(projectDir, SPECS_DIR, name);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
}

export function issueNumberOf(text) {
  return ISSUE_LINE.exec(text ?? "")?.[1];
}

/** 이슈 번호로 그 이슈를 가리키는 spec 파일명을 찾는다 (여러 개면 첫 번째) */
export function specForIssue(projectDir, issue) {
  return listSpecs(projectDir).find((name) => issueNumberOf(readSpec(projectDir, name)) === String(issue));
}

// ── 체크박스 (원본 = spec의 ### Acceptance, 이슈는 ## 완료 조건/## Acceptance 복사본) ──

/**
 * spec의 "### Acceptance" 또는 이슈의 "## 완료 조건 / ## Acceptance" 섹션 본문.
 * 헤딩 레벨을 인식해 같은 레벨 이하 헤딩(또는 ---)에서 멈춘다 → 하위(### 기능 등)는 포함.
 */
export function acceptanceSection(text) {
  const src = text ?? "";
  const head = /^(#{2,3})[ \t]*(?:Acceptance|완료 조건)[^\n]*$/m.exec(src);
  if (!head) return "";
  const level = head[1].length;
  const rest = src.slice(head.index + head[0].length);
  const stop = new RegExp(`^#{1,${level}}[ \\t]|^---[ \\t]*$`, "m").exec(rest);
  return stop ? rest.slice(0, stop.index) : rest;
}

export function parseChecklist(text) {
  const items = [];
  for (const line of (text ?? "").split("\n")) {
    const m = /^\s*[-*] \[( |x|X)\] (.+)$/.exec(line);
    if (!m) continue;
    const checked = m[1] !== " ";
    items.push({ text: m[2].trim(), checked, reasoned: !checked && REASON_MARK.test(m[2]) });
  }
  return items;
}

// ── TASKS.md ────────────────────────────────────────────────

const STATUS_RE = /(done|in-progress|todo|blocked|review)/i;
const STATUS_CELL_RE = /^(?:[✅🟡⬜🔴🟢]\s*)?\*{0,2}(?:done|in-progress|todo|blocked|review)\b/i;

/** TASKS.md의 태스크 행들 → { id, status, specIds[] } */
export function parseTaskRows(tasksText) {
  const rows = [];
  for (const line of (tasksText ?? "").split("\n")) {
    if (!/^\|\s*(?:TASK-[\w-]+|F\d\w*)\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    const id = cells[1];
    const statusCell = cells.find((c) => STATUS_CELL_RE.test(c)) ?? "";
    const status = STATUS_RE.exec(statusCell)?.[1]?.toLowerCase();
    const specIds = [...line.matchAll(/specs\/(\d{4})-/g)].map((m) => m[1]);
    rows.push({ id, status, specIds });
  }
  return rows;
}

/** done인 태스크들이 연결한 spec 번호(유니크) */
export function doneSpecIds(tasksText) {
  return [...new Set(parseTaskRows(tasksText).filter((r) => r.status === "done").flatMap((r) => r.specIds))];
}

// ── 게이트 판정 (오프라인) ─────────────────────────────────────

/**
 * 이슈·체크박스 기록 문제 목록. 비어 있으면 통과.
 * (a) 0023+ spec은 이슈 번호 필수  (b) done 태스크의 연결 spec에 사유 없는 미체크 금지
 */
export function inspectIssueRecords(projectDir) {
  const problems = [];

  for (const name of listSpecs(projectDir)) {
    const id = specId(name);
    if (id < ISSUE_REQUIRED_FROM) continue; // 도입 전 spec 면제
    const text = readSpec(projectDir, name);
    if (!issueNumberOf(text)) {
      problems.push(
        `${SPECS_DIR}/${name}: 이슈 번호가 없습니다 ("> **관련 태스크**: #번호"). 이슈를 먼저 만들고 그 이슈에서 브랜치를 만드세요 (gh issue develop <번호> --name <접두사>/<번호>-슬러그 --base develop)`,
      );
    }
  }

  const tasksPath = join(projectDir, TASKS_FILE);
  const tasks = existsSync(tasksPath) ? readFileSync(tasksPath, "utf8") : "";
  const specNames = listSpecs(projectDir);
  for (const id of doneSpecIds(tasks)) {
    const name = specNames.find((n) => specId(n) === id);
    if (!name) continue;
    const abandoned = parseChecklist(acceptanceSection(readSpec(projectDir, name))).filter(
      (i) => !i.checked && !i.reasoned,
    );
    for (const item of abandoned) {
      problems.push(
        `${SPECS_DIR}/${name}: done 태스크인데 사유 없이 미체크된 완료 조건 — "${item.text.slice(0, 60)}" (체크하거나 "(후속 #번호)"처럼 사유를 적으세요)`,
      );
    }
  }

  return problems;
}
