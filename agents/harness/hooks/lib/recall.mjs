// 복기 주입 — 지난 작업에서 남긴 것(미처리 [보완], 최근 작업 일지)을 다음 작업의 AI 컨텍스트로 넣는다.
// 원본은 저장소 안(커밋 [보완], agents/JOURNAL.md). Notion은 게시용이라 여기서 읽지 않는다. 하네스 이식 4/4(#85).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractFollowups, followupMentioned } from "../../metrics/lib.mjs";
import { git, TASKS_FILE } from "../../lib/records.mjs";

export const RECALL_STATE_FILE = "agents/harness/hooks/.recall-state.json";
const MAX_ITEM = 120;
const MAX_TOTAL = 1500;
const clip = (t, n = MAX_ITEM) => (t.length > n ? `${t.slice(0, n)}…` : t);

/** 커밋 메시지들(오래된 → 최신)에서 이후에 언급되지 않은 [보완] 항목. 최신 것부터 limit개 */
export function pendingFollowups(commits, tasksText, limit = 6) {
  const out = [];
  commits.forEach(({ subject, body }, i) => {
    const later = [...commits.slice(i + 1).map((c) => `${c.subject}\n${c.body}`), tasksText];
    for (const item of extractFollowups(body)) {
      if (!followupMentioned(item, later)) out.push({ item, from: subject });
    }
  });
  return out.reverse().slice(0, limit);
}

/**
 * ClauseLens JOURNAL(agents/JOURNAL.md)의 최근 n개 항목 → { date, task, gap }.
 * 형식: "## 2026-09-30 · Claude · 제목" 섹션 + "- **다음/주의**: ..." 불릿. 최신이 위.
 */
export function recentJournal(journalText, n = 3) {
  const entries = [];
  let cur = null;
  for (const line of (journalText ?? "").split("\n")) {
    const h = /^##\s+(\S+)\s+·\s+[^·]+·\s+(.+)$/.exec(line);
    if (h) {
      cur = { date: h[1], task: h[2].trim(), gap: "" };
      entries.push(cur);
      continue;
    }
    if (cur && !cur.gap) {
      const b = /^\s*[-*]\s+\*\*(?:다음\/주의|다음|주의)\*\*\s*:?\s*(.+)$/.exec(line);
      if (b) cur.gap = b[1].trim();
    }
  }
  return entries.slice(0, n).map((e) => ({ date: e.date, task: e.task, gap: e.gap || "-" }));
}

export function renderRecap({ followups, journal, status }) {
  const lines = ["[복기] 지난 작업에서 남긴 것 — 이번 작업과 관련 있으면 먼저 반영하거나 TASKS/이슈에 등록하세요."];
  if (followups.length) {
    lines.push("미처리 [보완] (최근 커밋에서, 이후 언급 없음):");
    for (const f of followups) lines.push(`- ${clip(f.item)} ← ${clip(f.from, 60)}`);
  }
  if (journal.length) {
    lines.push("최근 작업 일지:");
    for (const j of journal) lines.push(`- ${j.date} ${clip(j.task, 60)} — 다음/주의: ${clip(j.gap ?? "-", 90)}`);
  }
  if (status) lines.push(status);
  const text = lines.join("\n");
  return text.length > MAX_TOTAL ? `${text.slice(0, MAX_TOTAL)}…` : text;
}

export function readCommits(projectDir, n = 40) {
  const raw = git(projectDir, ["log", `-${n}`, "--reverse", "--no-merges", "--format=%s%x1f%b%x1e"]);
  return raw
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [subject, body = ""] = c.split("\x1f");
      return { subject, body };
    });
}

export function buildRecap(projectDir, status) {
  const read = (rel) => (existsSync(join(projectDir, rel)) ? readFileSync(join(projectDir, rel), "utf8") : "");
  const followups = pendingFollowups(readCommits(projectDir), read(TASKS_FILE));
  const journal = recentJournal(read("agents/JOURNAL.md"));
  return { text: renderRecap({ followups, journal, status }), followups: followups.length, journal: journal.length };
}

// ── 언제 주입하나: 대화마다 마지막으로 주입한 날짜·브랜치가 바뀌었을 때만 ──

export function shouldInject(state, session, date, branch) {
  const last = state[session];
  return !last || last.date !== date || last.branch !== branch;
}

export function readState(projectDir) {
  try {
    return JSON.parse(readFileSync(join(projectDir, RECALL_STATE_FILE), "utf8"));
  } catch {
    return {};
  }
}

export function writeState(projectDir, state) {
  const entries = Object.entries(state).slice(-50); // 최근 50개 대화만 유지
  writeFileSync(join(projectDir, RECALL_STATE_FILE), JSON.stringify(Object.fromEntries(entries)));
}

export function today() {
  return new Date().toLocaleDateString("sv-SE"); // 로컬 날짜 YYYY-MM-DD
}
