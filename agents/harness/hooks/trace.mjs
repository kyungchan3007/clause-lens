#!/usr/bin/env node
// Claude Code hook: 도구 호출·프롬프트를 현재 작업 폴더의 trace.auto.jsonl에 한 줄씩 남긴다.
// 브랜치가 <접두사>/<이슈번호>-* 이고 그 이슈의 spec 폴더가 있으면 그 폴더에, 아니면 커밋되지 않는 위치에 쓴다.
// 어떤 경우에도 exit 0 — 기록 실패가 에이전트 작업을 막으면 안 된다.
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { branchIssueNumber, currentBranch, folderForIssue, SPECS_DIR } from "../lib/records.mjs";

export const UNASSIGNED_FILE = "agents/harness/hooks/.unassigned.jsonl";
const MAX_TEXT = 200;

const SECRET_PATTERNS = [
  [/\b(ghp|gho|ghu|ghs|github_pat|sk|sk-ant|xoxb|xoxp)[-_][A-Za-z0-9_-]{8,}/g, "[REDACTED]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]"],
  [/\b(Bearer)\s+\S+/gi, "$1 [REDACTED]"],
  [/\b((?:api[_-]?key|token|secret|password|passwd|authorization)\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1[REDACTED]"],
];

export function redact(text) {
  return SECRET_PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/** 절대 경로를 프로젝트 기준 상대 경로로, 홈 경로는 ~ 로 바꾼 뒤 비밀값을 가리고 자른다 */
export function sanitize(text, projectDir, home = homedir()) {
  let out = String(text);
  if (projectDir) out = out.split(projectDir + "/").join("").split(projectDir).join("<project>");
  if (home) out = out.split(home).join("~");
  out = redact(out).replace(/\s+/g, " ").trim();
  return out.length > MAX_TEXT ? out.slice(0, MAX_TEXT) + "…" : out;
}

function describeTool(toolName, input = {}) {
  switch (toolName) {
    case "Bash":
      return input.command;
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return input.file_path ?? input.notebook_path;
    case "Grep":
    case "Glob":
      return [input.pattern, input.path].filter(Boolean).join(" @ ");
    case "WebFetch":
      return input.url;
    case "WebSearch":
      return input.query;
    case "Task":
    case "Agent":
      return input.description;
    default:
      return "";
  }
}

export function toEntry(input, projectDir, now = new Date()) {
  const event = input.hook_event_name;
  const entry = { ts: now.toISOString(), session: String(input.session_id ?? "").slice(0, 8), event };
  if (input.agent_type) entry.role = input.agent_type;

  if (event === "UserPromptSubmit") {
    entry.detail = sanitize(input.prompt ?? "", projectDir);
  } else if (event === "SessionStart") {
    entry.detail = String(input.source ?? "");
  } else if (input.tool_name) {
    entry.tool = input.tool_name;
    entry.detail = sanitize(describeTool(input.tool_name, input.tool_input) ?? "", projectDir);
    if (event === "PreToolUse") {
      entry.ok = false;
      entry.blocked = true;
      if (input.reason) entry.error = sanitize(input.reason, projectDir);
    } else if (event === "PostToolUseFailure") {
      entry.ok = false;
      if (input.error) entry.error = sanitize(input.error, projectDir);
    } else {
      entry.ok = true;
    }
  }
  return entry;
}

/** 기록할 파일(프로젝트 기준 상대 경로)을 정한다: 이슈의 spec 폴더가 있으면 거기, 없으면 미배정 파일 */
export function resolveTraceFile(projectDir, branch) {
  const folder = folderForIssue(projectDir, branchIssueNumber(branch));
  return folder ? `${SPECS_DIR}/${folder}/trace.auto.jsonl` : UNASSIGNED_FILE;
}

/** 현재 작업의 자동 기록 파일에 한 줄을 남긴다 (guard가 차단을 기록할 때도 쓴다) */
export function appendTrace(projectDir, entry) {
  const file = join(projectDir, resolveTraceFile(projectDir, currentBranch(projectDir)));
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(entry) + "\n");
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  appendTrace(projectDir, toEntry(input, projectDir));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((error) => process.stderr.write(`[trace hook] ${error?.message ?? error}\n`))
    .finally(() => process.exit(0));
}
