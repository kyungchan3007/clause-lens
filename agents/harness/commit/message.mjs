// 커밋 메시지 규칙 — 지침서: agents/harness/commit-and-issue.md
// 작업 브랜치 커밋은 [허점] [보완] [컨텍스트·토큰] 세 섹션에 내용이 있어야 한다.

export const SECTIONS = ["[허점]", "[보완]", "[컨텍스트·토큰]"];
const TRAILER = /^[A-Za-z][A-Za-z-]*: /; // Co-Authored-By: 등
const PLACEHOLDER = /^-?\s*(\(.*작성.*\)|TODO|없음을 확인하지 않음)?\s*$/;

function bodyLines(message) {
  // # 로 시작하는 줄은 git이 지우는 주석이므로 검사에서 제외
  return message.split("\n").filter((line) => !line.startsWith("#"));
}

export function isExempt(message) {
  const subject = bodyLines(message)[0] ?? "";
  return /^(Merge |fixup! |squash! |Revert ")/.test(subject);
}

function sectionContent(lines, header) {
  const start = lines.findIndex((line) => line.trim().startsWith(header));
  if (start === -1) return undefined;
  const inline = lines[start].trim().slice(header.length).trim();
  const body = [];
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (SECTIONS.some((h) => t.startsWith(h)) || TRAILER.test(t)) break;
    body.push(t);
  }
  return [inline, ...body].filter((t) => t && !PLACEHOLDER.test(t));
}

/** 문제 목록. 비어 있으면 통과 */
export function checkMessage(message) {
  if (isExempt(message)) return [];
  const lines = bodyLines(message);
  const problems = [];
  for (const header of SECTIONS) {
    const content = sectionContent(lines, header);
    if (content === undefined) problems.push(`${header} 섹션이 없습니다`);
    else if (content.length === 0) problems.push(`${header} 섹션이 비어 있습니다`);
  }
  return problems;
}

/** [컨텍스트·토큰]이 없으면 트레일러(Co-Authored-By 등) 앞에 section을 끼워 넣는다 */
export function insertSection(message, section) {
  if (message.split("\n").some((line) => line.trim().startsWith("[컨텍스트·토큰]"))) return message;
  const lines = message.replace(/\n+$/, "").split("\n");
  let cut = lines.length;
  // 첫 줄(제목)은 "feat: x"처럼 트레일러 모양이어도 트레일러가 아니다
  while (cut > 1 && (TRAILER.test(lines[cut - 1]) || lines[cut - 1].trim() === "")) cut--;
  const head = lines.slice(0, cut).join("\n");
  const trailers = lines.slice(cut).filter((l) => l.trim()).join("\n");
  return `${head}\n\n${section}${trailers ? `\n\n${trailers}` : ""}\n`;
}

export const GUIDE = [
  "작업 브랜치 커밋에는 세 섹션이 필요합니다 (지침서: agents/harness/commit-and-issue.md):",
  "  [허점]           이번 작업에서 드러난 엔지니어링 허점 (없으면 '- 발견 못 함: <확인한 범위>')",
  "  [보완]           보완해야 할 점·후속 작업",
  "  [컨텍스트·토큰]  비어 있으면 prepare-commit-msg가 pnpm usage로 자동 채움",
].join("\n");
