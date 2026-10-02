// 이슈·체크박스 기록 판정 — 게이트(check-issue-records)와 네트워크 명령(issue-link·issue-sync)이 공유.
// harness-lab에서 발췌·적응. ClauseLens spec은 0001~0024 단일 파일 + 0025~ 폴더형(prd/sdd/trace), base=develop.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SPECS_DIR = "agents/intent/specs";
export const TASKS_FILE = "agents/orchestration/TASKS.md";

// 자동 기록(trace.auto) 저장 위치 — spec 폴더 밖(브랜치 전환 잔재 방지, #154). git 미추적.
export const TRACE_AUTO_DIR = ".harness/trace";
// 과거 spec 폴더 안에 남을 수 있던 자동 기록 파일 이름(잔재 판정용)
export const AUTO_TRACE_BASENAMES = ["trace.auto.jsonl"];

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
  const folderNames = listTaskFolders(projectDir);
  for (const id of doneSpecIds(tasks)) {
    // 단일 파일 spec 우선, 없으면 폴더형(prd.md) — 둘 다 done 미체크를 검사
    const fileName = specNames.find((n) => specId(n) === id);
    const folder = folderNames.find((n) => specId(n) === id);
    let rel, text;
    if (fileName) {
      rel = `${SPECS_DIR}/${fileName}`;
      text = readSpec(projectDir, fileName);
    } else if (folder) {
      rel = `${SPECS_DIR}/${folder}/prd.md`;
      text = readFolderFile(projectDir, folder, "prd.md");
    } else continue;
    const abandoned = parseChecklist(acceptanceSection(text)).filter((i) => !i.checked && !i.reasoned);
    for (const item of abandoned) {
      problems.push(
        `${rel}: done 태스크인데 사유 없이 미체크된 완료 조건 — "${item.text.slice(0, 60)}" (체크하거나 "(후속 #번호)"처럼 사유를 적으세요)`,
      );
    }
  }

  return problems;
}

// ── 폴더형 spec (하네스 이식 3/4, #84) ─────────────────────────
// 새 작업(FOLDER_REQUIRED_FROM 이상)은 폴더(prd.md·sdd.md·trace.md)로. 0001~0024 단일 파일은 면제.

export const FOLDER_REQUIRED_FROM = "0025";

// 코드 수정 전에도 항상 허용하는 기록 경로
export const RECORD_PREFIXES = ["agents/intent/", "agents/orchestration/", "agents/JOURNAL.md", "LEARNINGS.md"];

export function isRecordPath(relPath) {
  return RECORD_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(prefix));
}

export function listTaskFolders(projectDir) {
  const dir = join(projectDir, SPECS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-/.test(d.name))
    .map((d) => d.name)
    .sort();
}

export function readFolderFile(projectDir, folder, name) {
  const p = join(projectDir, SPECS_DIR, folder, name);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
}

/**
 * 브랜치 전환 잔재 폴더인가 — 게이트가 건너뛸 대상(#154).
 * 기준(좁게): prd·sdd·trace가 전부 없고, 폴더 안이 git 미추적 자동기록(trace.auto.jsonl류)뿐.
 * - 필수 기록(prd/sdd/trace)이 하나라도 있으면 "작업 중 폴더" → 검사 대상(false).
 * - 자동기록 외 파일/하위 폴더가 있거나, 추적되는 파일이 있으면 잔재로 보지 않음(false) → 진짜 누락 유지.
 * (A안으로 원인을 없앴지만, 과거/타 경로 잔재에 대비해 방어로 둔다.)
 */
export function isResidualAutoTraceFolder(projectDir, folder) {
  const dir = join(projectDir, SPECS_DIR, folder);
  if (!existsSync(dir)) return false;
  if (["prd.md", "sdd.md", "trace.md"].some((n) => existsSync(join(dir, n)))) return false;
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.length === 0) return false; // 빈 폴더는 잔재로 보지 않음(기존 FAIL 동작 유지)
  if (!entries.every((e) => e.isFile() && AUTO_TRACE_BASENAMES.includes(e.name))) return false;
  // 아래 git() 호출은 방어 로직이 이미 내장돼 있다(상단 git 헬퍼 참조):
  //   · try/catch로 ENOENT(git 미설치)·실행 오류를 삼켜 "" 반환 → 절대 throw 안 함(프로세스 중단 X)
  //   · 출력을 .trim() 후 반환 → "true\n" 같은 개행/공백 없이 === "true" 비교 안전
  // 그래서 여기서 추가 try/catch·.trim()은 불필요하다.
  // git을 못 쓰면(비-git·오류로 "" 반환) 추적 여부를 알 수 없으므로 fail-open:
  // 잔재로 보지 않아(return false) 게이트가 진짜 누락(prd/sdd 부재)을 계속 FAIL로 잡게 한다.
  // (fail-closed로 스킵하면 비-git 환경에서 누락을 은닉)
  if (git(projectDir, ["rev-parse", "--is-inside-work-tree"]) !== "true") return false;
  // git에 추적되는 파일이 하나라도 있으면(의도된 파일) 잔재가 아님
  return git(projectDir, ["ls-files", `${SPECS_DIR}/${folder}`]) === "";
}

/** 이슈 번호로 폴더 spec 찾기 (prd.md의 이슈 번호 기준) */
export function folderForIssue(projectDir, issue) {
  return listTaskFolders(projectDir).find((f) => issueNumberOf(readFolderFile(projectDir, f, "prd.md")) === String(issue));
}

/**
 * 이슈 번호로 Acceptance 원본을 찾는다 — 단일 파일 spec과 폴더형(prd.md) 모두 지원.
 * 단일 파일 우선, 없으면 폴더형(prd.md의 ### Acceptance)을 본다.
 * @returns {{ name: string, text: string|undefined, kind: "file"|"folder" }|undefined}
 */
export function acceptanceSourceForIssue(projectDir, issue) {
  const fileName = specForIssue(projectDir, issue);
  if (fileName) return { name: fileName, text: readSpec(projectDir, fileName), kind: "file" };
  const folder = folderForIssue(projectDir, issue);
  if (folder) return { name: `${folder}/prd.md`, text: readFolderFile(projectDir, folder, "prd.md"), kind: "folder" };
  return undefined;
}

const SDD_KEYWORDS = ["접근", "대안", "검증"];

export function checkFolderPrd(text, id) {
  const problems = [];
  if (/NNNN|<태스크 제목>|— 제목 —|<기능 이름>/.test(text.split("\n")[0] ?? "")) problems.push("제목을 실제 태스크명으로 채우세요");
  if (!/^\s*[-*] \[[ xX]\] \S/m.test(acceptanceSection(text))) problems.push("Acceptance에 내용 있는 체크박스를 1개 이상 쓰세요");
  if (id >= FOLDER_REQUIRED_FROM && !issueNumberOf(text)) problems.push('"- **이슈:** #번호"(또는 "관련 태스크: #번호")가 없습니다');
  return problems;
}

export function checkFolderSdd(text) {
  return SDD_KEYWORDS.filter((k) => !(text ?? "").includes(k)).map((k) => `SDD에 "${k}" 관련 내용을 채우세요`);
}

export function checkFolderTrace(text) {
  const body = (text ?? "").split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.trim().startsWith(">")).join("").trim();
  return body.length > 10 ? [] : ["trace.md에 판단·막힘·되돌림 등 실제 과정을 기록하세요(템플릿만 있으면 안 됨)"];
}

/** 폴더 spec 하나의 기록 상태. requireTrace=false면 trace 검사 생략(코드 수정 전 게이트용). */
export function inspectTaskFolder(projectDir, folder, { requireTrace = true } = {}) {
  const id = specId(folder);
  const problems = [];
  const prd = readFolderFile(projectDir, folder, "prd.md");
  if (prd === undefined) problems.push(`${SPECS_DIR}/${folder}/prd.md 가 없습니다 (템플릿: agents/intent/templates/prd.md)`);
  else problems.push(...checkFolderPrd(prd, id).map((p) => `prd.md: ${p}`));
  const sdd = readFolderFile(projectDir, folder, "sdd.md");
  if (sdd === undefined) problems.push(`${SPECS_DIR}/${folder}/sdd.md 가 없습니다 (템플릿: agents/intent/templates/sdd.md)`);
  else problems.push(...checkFolderSdd(sdd).map((p) => `sdd.md: ${p}`));
  if (requireTrace) {
    const trace = readFolderFile(projectDir, folder, "trace.md");
    if (trace === undefined) problems.push(`${SPECS_DIR}/${folder}/trace.md 가 없습니다`);
    else problems.push(...checkFolderTrace(trace).map((p) => `trace.md: ${p}`));
  }
  // done 태스크면 완료 조건 미체크(사유無) 금지
  const tasks = existsSync(join(projectDir, TASKS_FILE)) ? readFileSync(join(projectDir, TASKS_FILE), "utf8") : "";
  if (prd !== undefined && doneSpecIds(tasks).includes(id)) {
    for (const item of parseChecklist(acceptanceSection(prd)).filter((i) => !i.checked && !i.reasoned)) {
      problems.push(`prd.md: done 태스크인데 사유 없이 미체크된 완료 조건 — "${item.text.slice(0, 60)}"`);
    }
  }
  return problems;
}

// ── PreToolUse / Stop 판정 ─────────────────────────────────────

function branchGuideMessage(relPath, branch) {
  return [
    `[기록 강제] ${relPath} 수정 차단: 현재 브랜치(${branch || "알 수 없음"})가 이슈 브랜치가 아닙니다.`,
    "먼저: gh issue create → gh issue develop <이슈> --base develop --name <접두사>/<이슈번호>-슬러그 --checkout",
  ].join("\n");
}

/** 코드 수정 허용 여부(PreToolUse). 차단이면 이유를 돌려준다. */
export function decideEdit(projectDir, relPath) {
  if (relPath.startsWith("..") || relPath.startsWith("/")) return { allow: true };
  if (isRecordPath(relPath)) return { allow: true };

  const branch = currentBranch(projectDir);
  const issue = branchIssueNumber(branch);
  if (!issue) return { allow: false, reason: branchGuideMessage(relPath, branch) };

  // 도입 전 단일 파일 spec 태스크는 폴더 요구에서 면제
  if (specForIssue(projectDir, issue)) return { allow: true };

  const folder = folderForIssue(projectDir, issue);
  if (!folder) {
    return {
      allow: false,
      reason: `[기록 강제] ${relPath} 수정 차단: 이슈 #${issue}의 spec 폴더가 없습니다.\n${SPECS_DIR}/<번호>-슬러그/ 에 prd.md·sdd.md·trace.md를 먼저 작성하세요 (agents/intent/templates/).`,
    };
  }
  const problems = inspectTaskFolder(projectDir, folder, { requireTrace: false });
  if (problems.length > 0) {
    return { allow: false, reason: `[기록 강제] ${relPath} 수정 차단: 코드보다 PRD·SDD·TASKS가 먼저입니다.\n${problems.map((p) => `- ${p}`).join("\n")}` };
  }
  return { allow: true };
}

export function changedFiles(projectDir) {
  const base =
    git(projectDir, ["merge-base", "HEAD", "develop"]) ||
    git(projectDir, ["merge-base", "HEAD", "chan/develop"]) ||
    git(projectDir, ["merge-base", "HEAD", "origin/develop"]);
  const committed = base ? git(projectDir, ["diff", "--name-only", `${base}...HEAD`]) : "";
  const working = git(projectDir, ["diff", "--name-only", "HEAD"]);
  const staged = git(projectDir, ["diff", "--name-only", "--cached"]);
  const untracked = git(projectDir, ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([committed, working, staged, untracked].join("\n").split("\n").filter(Boolean))];
}

/** 응답 종료 전 기록 점검(Stop). 문제가 있으면 problems를 돌려준다. */
export function checkBeforeStop(projectDir) {
  const changed = changedFiles(projectDir);
  const codeChanged = changed.filter((f) => !isRecordPath(f));
  if (codeChanged.length === 0) return [];

  const branch = currentBranch(projectDir);
  const issue = branchIssueNumber(branch);
  if (!issue) return [`이슈 브랜치가 아닌 ${branch || "알 수 없는 브랜치"}에서 코드가 바뀌었습니다: ${codeChanged.slice(0, 5).join(", ")}`];
  if (specForIssue(projectDir, issue)) return []; // 단일 파일 spec 태스크(도입 전)는 trace 면제

  const folder = folderForIssue(projectDir, issue);
  if (!folder) return [`이슈 #${issue}의 spec 폴더(${SPECS_DIR}/<번호>-슬러그/)가 없습니다`];

  const problems = inspectTaskFolder(projectDir, folder);
  if (!changed.includes(`${SPECS_DIR}/${folder}/trace.md`)) {
    problems.push("trace.md가 이번 태스크에서 갱신되지 않았습니다. 판단·이유·막힘·되돌림을 기록하세요");
  }
  return problems;
}
