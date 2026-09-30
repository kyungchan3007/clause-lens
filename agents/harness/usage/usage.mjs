#!/usr/bin/env node
// Claude Code transcript에서 현재 브랜치의 토큰·컨텍스트 사용량을 집계한다.
//   pnpm usage                       현재 작업 브랜치 (transcript의 gitBranch 기준)
//   pnpm usage --commit              커밋 메시지용 [컨텍스트·토큰] 섹션 출력
//   pnpm usage --transcript F --since ISO [--until ISO]   브랜치 밖 세션의 시간 구간
// 주: 읽은 파일 수(trace) 집계는 이식 3/4(#84)에서. Codex 커밋은 Claude 기록이 없어 "집계 불가"로 표시된다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { currentBranch } from "../lib/records.mjs";

/** Claude Code가 프로젝트별 transcript를 두는 폴더 이름 규칙: 경로의 영숫자 외 문자를 - 로 */
export function projectTranscriptDir(projectDir, home = homedir()) {
  return join(home, ".claude", "projects", projectDir.replace(/[^A-Za-z0-9]/g, "-"));
}

export function listJsonl(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listJsonl(path); // 서브에이전트 기록 포함
    return name.endsWith(".jsonl") ? [path] : [];
  });
}

/** transcript 줄들에서 요청(assistant 응답) 목록을 뽑는다. 같은 message.id는 한 번만 */
export function extractRequests(lines, filter = () => true) {
  const seen = new Map();
  for (const line of lines) {
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const m = d?.message;
    if (d?.type !== "assistant" || !m?.usage || !filter(d)) continue;
    const key = m.id ?? d.uuid;
    if (seen.has(key)) continue;
    const u = m.usage;
    seen.set(key, {
      session: d.sessionId,
      model: m.model,
      ts: d.timestamp,
      input: u.input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    });
  }
  return [...seen.values()];
}

export function summarize(requests) {
  const sum = (k) => requests.reduce((acc, r) => acc + r[k], 0);
  const contexts = requests.map((r) => r.input + r.cacheRead + r.cacheWrite);
  const sorted = [...requests].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const last = sorted.at(-1);
  return {
    requests: requests.length,
    sessions: new Set(requests.map((r) => r.session)).size,
    models: [...new Set(requests.map((r) => r.model).filter(Boolean))],
    input: sum("input"),
    cacheWrite: sum("cacheWrite"),
    cacheRead: sum("cacheRead"),
    output: sum("output"),
    maxContext: contexts.length ? Math.max(...contexts) : 0,
    lastContext: last ? last.input + last.cacheRead + last.cacheWrite : 0,
  };
}

export function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function renderSection(s, { scope }) {
  if (s.requests === 0) return `[컨텍스트·토큰]\n- 집계 불가: ${scope}에 해당하는 Claude Code 기록이 없음`;
  return [
    "[컨텍스트·토큰]",
    `- 범위: ${scope} · 세션 ${s.sessions}개 · 요청 ${s.requests}회 · 모델 ${s.models.join(", ") || "?"}`,
    `- 토큰: 입력 ${fmt(s.input)} · 캐시 쓰기 ${fmt(s.cacheWrite)} · 캐시 읽기 ${fmt(s.cacheRead)} · 출력 ${fmt(s.output)}`,
    `- 컨텍스트: 최대 ${fmt(s.maxContext)} · 마지막 ${fmt(s.lastContext)}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = { commit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--commit") args.commit = true;
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
  }
  return args;
}

export function collect(projectDir, args = {}) {
  if (args.transcript) {
    const since = args.since ?? "";
    const until = args.until ?? "9999";
    const lines = readFileSync(args.transcript, "utf8").split("\n");
    const requests = extractRequests(lines, (d) => d.timestamp >= since && d.timestamp <= until);
    return { summary: summarize(requests), scope: `세션 구간 ${since.slice(0, 16) || "처음"} ~ ${until === "9999" ? "지금" : until.slice(0, 16)}` };
  }
  const branch = currentBranch(projectDir);
  const lines = listJsonl(projectTranscriptDir(projectDir)).flatMap((f) => readFileSync(f, "utf8").split("\n"));
  const requests = extractRequests(lines, (d) => d.gitBranch === branch);
  return { summary: summarize(requests), scope: `브랜치 ${branch} 누적` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const args = parseArgs(process.argv.slice(2));
  const { summary, scope } = collect(root, args);
  if (args.commit) console.log(renderSection(summary, { scope }));
  else console.log(JSON.stringify({ scope, ...summary }, null, 2));
}
