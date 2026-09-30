// 복기 참조·체크박스 측정 — 순수 함수 (입출력은 metrics.mjs). 하네스 이식 4/4(#85).
import { REASON_MARK } from "../lib/records.mjs";

export const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

/** 과거 기록 분류 규칙. 보고서에 함께 출력해 판정 근거를 드러낸다 */
export const PAST_RECORD_RULES = [
  ["작업 기록", /JOURNAL|LEARNINGS|TASKS\.md/],
  ["태스크 문서", /\/specs\/|\bprd\.md|\bsdd\.md|trace\.md/],
  ["메모리", /\/memory\//],
  ["git·이슈 이력", /git (log|show)|gh (issue|pr) view/],
];
const NOTION = /notion-(fetch|search)/;

export const CHECK_REQUEST = /체크\s*(해|박스|표시)|check ?box/i;
export { REASON_MARK };

export function localDate(ts, offsetHours = 9) {
  return new Date(new Date(ts).getTime() + offsetHours * 3600_000).toISOString().slice(0, 10);
}

// Bash로 파일을 쓰는 명령: 리다이렉트(> >>, 단 2>&1·>/dev/null 제외)·sed -i·tee·git commit
const BASH_WRITE = /(^|[^0-9&>])>{1,2}\s*(?!&|\/dev\/null)[^\s|;&]+|\bsed -i\b|\btee\b|\bgit commit\b/;
const BASH_READ = /\b(cat|head|tail|less|grep|rg|awk|sed -n)\b/;

/** 수정으로 볼 도구 호출인가 (편집 도구 또는 파일을 쓰는 Bash) */
export function isEdit(name, input) {
  if (EDIT_TOOLS.has(name)) return true;
  return name === "Bash" && BASH_WRITE.test(String(input?.command ?? ""));
}

/** 도구 호출 하나가 과거 기록을 읽는 것이면 분류 이름, 아니면 undefined */
export function classifyPastRead(name, input) {
  if (NOTION.test(name)) return "Notion";
  if (isEdit(name, input)) return undefined;
  if (name === "Bash") {
    const cmd = String(input?.command ?? "");
    if (PAST_RECORD_RULES[3][1].test(cmd)) return "git·이슈 이력";
    if (!BASH_READ.test(cmd)) return undefined;
    return PAST_RECORD_RULES.slice(0, 3).find(([, re]) => re.test(cmd))?.[0];
  }
  if (!["Read", "Grep", "Glob"].includes(name)) return undefined;
  const text = JSON.stringify(input ?? {});
  return PAST_RECORD_RULES.slice(0, 3).find(([, re]) => re.test(text))?.[0];
}

/** transcript 줄 → 시간순 이벤트 (요청 | 도구 호출). 사이드체인·도구 결과·메타·중복 제외 */
export function toEvents(lines) {
  const events = [];
  const seenTools = new Set();
  for (const line of lines) {
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (!d || d.isSidechain) continue;
    const m = d.message;
    if (d.type === "user" && typeof m?.content === "string" && !d.isMeta) {
      events.push({ kind: "prompt", ts: d.timestamp, branch: d.gitBranch ?? "", text: m.content });
    } else if (d.type === "assistant" && Array.isArray(m?.content)) {
      for (const c of m.content) {
        if (c?.type !== "tool_use" || seenTools.has(c.id)) continue;
        seenTools.add(c.id);
        events.push({ kind: "tool", ts: d.timestamp, branch: d.gitBranch ?? "", name: c.name, input: c.input });
      }
    }
  }
  return events.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

// 읽기·쓰기 대상 식별자: 파일 경로(끝부분) 또는 Notion 페이지 id(32자리 hex)
function targetOf(name, input) {
  const raw = String(input?.file_path ?? input?.page_id ?? input?.id ?? input?.command ?? "");
  const notion = raw.replace(/-/g, "").match(/[0-9a-f]{32}/)?.[0];
  if (/notion/.test(name) && notion) return `notion:${notion}`;
  return raw;
}

const WRITE_TARGET = (name) => EDIT_TOOLS.has(name) || /notion-(update-page|create-pages)/.test(name);

/**
 * 작업 시작 단위로 나눈다: 날짜(서울)가 바뀌거나 브랜치가 바뀐 첫 요청에서 새 단위.
 * 단위마다 첫 수정 전까지(맥락 파악 구간)의 과거 기록 읽기를 센다.
 * 단, 같은 단위에서 나중에 수정하는 대상(파일·Notion 페이지)을 읽은 것은 "쓰려고 읽은 것"이라 복기로 치지 않는다.
 */
export function segmentUnits(events, offsetHours = 9) {
  const groups = [];
  let cur;
  for (const e of events) {
    if (e.kind === "prompt") {
      const date = localDate(e.ts, offsetHours);
      if (!cur || cur.date !== date || cur.branch !== e.branch) {
        cur = { date, branch: e.branch, events: [] };
        groups.push(cur);
      }
    }
    if (cur) cur.events.push(e);
  }
  return groups.map(({ date, branch, events: ev }) => {
    const writes = ev.filter((e) => e.kind === "tool" && WRITE_TARGET(e.name)).map((e) => targetOf(e.name, e.input));
    const writtenLater = (t) => writes.some((w) => w && (t.includes(w) || w.includes(t)));
    const unit = { date, branch, start: ev[0]?.ts, prompts: 0, checkRequests: 0, toolsBeforeEdit: 0, edited: false, pastReads: {}, readToWrite: 0 };
    for (const e of ev) {
      if (e.kind === "prompt") {
        unit.prompts++;
        if (CHECK_REQUEST.test(e.text)) unit.checkRequests++;
        continue;
      }
      if (unit.edited) continue;
      if (isEdit(e.name, e.input)) {
        unit.edited = true;
        continue;
      }
      unit.toolsBeforeEdit++;
      const kind = classifyPastRead(e.name, e.input);
      if (!kind) continue;
      const target = targetOf(e.name, e.input);
      const recordFile = target.match(/[\w./-]*(JOURNAL|LEARNINGS|TASKS|prd|sdd|trace)[\w.-]*\.md/)?.[0];
      if (writtenLater(recordFile ?? target)) {
        unit.readToWrite++;
        continue;
      }
      unit.pastReads[kind] = (unit.pastReads[kind] ?? 0) + 1;
    }
    return unit;
  });
}

export function summarizeUnits(units) {
  const worked = units.filter((u) => u.toolsBeforeEdit > 0 || u.edited);
  const referenced = worked.filter((u) => Object.keys(u.pastReads).length > 0);
  const byKind = {};
  for (const u of worked) for (const [k, n] of Object.entries(u.pastReads)) byKind[k] = (byKind[k] ?? 0) + n;
  const kindUnits = {};
  for (const u of worked) for (const k of Object.keys(u.pastReads)) kindUnits[k] = (kindUnits[k] ?? 0) + 1;
  return {
    units: units.length,
    worked: worked.length,
    referenced: referenced.length,
    rate: worked.length ? referenced.length / worked.length : 0,
    byKind,
    kindUnits,
    checkRequests: units.reduce((a, u) => a + u.checkRequests, 0),
    readToWrite: units.reduce((a, u) => a + u.readToWrite, 0),
  };
}

/** 이슈 본문의 체크박스 */
export function parseCheckboxes(body = "") {
  const items = [];
  for (const line of body.split("\n")) {
    const m = /^\s*[-*] \[( |x|X)\] (.+)$/.exec(line);
    if (!m) continue;
    const checked = m[1] !== " ";
    items.push({ checked, reasoned: !checked && REASON_MARK.test(m[2]) });
  }
  return items;
}

export function summarizeIssues(issues) {
  let checked = 0, reasoned = 0, abandoned = 0, withAbandoned = 0, withBoxes = 0;
  for (const issue of issues) {
    const items = parseCheckboxes(issue.body);
    if (items.length) withBoxes++;
    const a = items.filter((i) => !i.checked && !i.reasoned).length;
    checked += items.filter((i) => i.checked).length;
    reasoned += items.filter((i) => i.reasoned).length;
    abandoned += a;
    if (a) withAbandoned++;
  }
  const total = checked + reasoned + abandoned;
  return { issues: issues.length, withBoxes, withAbandoned, total, checked, reasoned, abandoned, abandonRate: total ? abandoned / total : 0 };
}

/** 커밋 메시지에서 [보완] 항목 */
export function extractFollowups(message = "") {
  const lines = message.split("\n");
  const i = lines.findIndex((l) => l.trim().startsWith("[보완]"));
  if (i === -1) return [];
  const out = [];
  for (const l of lines.slice(i + 1)) {
    const t = l.trim();
    if (/^\[.+\]/.test(t) || /^[A-Za-z][A-Za-z-]*: /.test(t)) break;
    if (t.startsWith("- ")) out.push(t.slice(2).trim());
  }
  return out;
}

const STOP = new Set(["에서", "으로", "하는", "있는", "없는", "위한", "대한", "것을", "다음", "추가", "확인"]);
export function keywords(text) {
  const tokens = (text.match(/[A-Za-z0-9_.-]{3,}|[가-힣]{2,}/g) ?? []).filter((t) => !STOP.has(t));
  return [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 2);
}

/** [보완] 항목이 이후 텍스트(커밋·TASKS)에서 핵심어 2개 모두와 함께 등장하면 언급 후보 */
export function followupMentioned(item, laterTexts) {
  const kw = keywords(item);
  if (kw.length === 0) return false;
  return laterTexts.some((t) => kw.every((k) => t.includes(k)));
}

export function pct(x) {
  return `${Math.round(x * 100)}%`;
}
