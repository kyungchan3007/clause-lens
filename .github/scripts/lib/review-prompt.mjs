// PR AI 리뷰 프롬프트 빌드(순수 — env·네트워크 없음, 테스트 가능).
// 원문 고정(#155): 연결 이슈 본문·request.md를 "판정 기준 원문"으로 프롬프트에 넣고 요구별 대조를 지시.

export function truncate(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... [truncated]`;
}

export function parseChangedLines(patch) {
  const changedLines = new Set();
  if (!patch) return changedLines;

  let currentNewLine = null;

  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      currentNewLine = match ? Number.parseInt(match[1], 10) : null;
      continue;
    }

    if (currentNewLine == null || line.startsWith("\\")) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.add(currentNewLine);
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      continue;
    }

    currentNewLine += 1;
  }

  return changedLines;
}

/**
 * 원문(원래 요청) 섹션 포맷(#155). 역할 구분:
 * - request.md = 착수 시점 판정 기준
 * - 연결 이슈 본문 = 최신 변경 감지 자료
 * 둘 다 없으면 "검증 한계"를 명시해 리뷰가 원문 없이 진행됐음을 드러낸다.
 * @param {{ issueNumber?: number, issueTitle?: string, issueBody?: string, requestMd?: string }} [req]
 */
export function formatOriginalRequest(req = {}) {
  const { issueNumber, issueTitle, issueBody, requestMd } = req;
  const parts = [];
  if (requestMd && requestMd.trim()) {
    parts.push("원문 — request.md (착수 시점 요청, **요구 충족 판정의 기준**):", truncate(requestMd.trim(), 6000));
  }
  if (issueBody && issueBody.trim()) {
    parts.push(
      `연결 이슈 #${issueNumber ?? "?"}${issueTitle ? ` — ${issueTitle}` : ""} (최신 요청 — 변경 감지용):`,
      truncate(issueBody.trim(), 6000),
    );
  }
  if (parts.length === 0) {
    return [
      "원래 요청(원문): (조회 실패 — request.md·연결 이슈 모두 확보 못 함)",
      "⚠️ 검증 한계: 원문 없이 코드만으로 리뷰함. 요구사항 누락은 이 리뷰로 보장되지 않음 — 요약에 '원문 미확보'로 명시하라.",
    ].join("\n");
  }
  return parts.join("\n\n");
}

export function buildReviewPrompt(pr, files, { incremental, rangeCommits = [], priorFindings = [], originalRequest } = {}) {
  const patchable = files.filter((file) => file.patch && file.status !== "removed");
  const reviewedFiles = patchable
    .slice(0, 12)
    .map((file) => {
      const changedLines = [...parseChangedLines(file.patch)].slice(0, 200).join(", ");
      return [
        `FILE: ${file.filename}`,
        `STATUS: ${file.status}`,
        `ADDITIONS: ${file.additions} DELETIONS: ${file.deletions}`,
        `CHANGED_LINES_ON_RIGHT: ${changedLines || "none"}`,
        "PATCH:",
        truncate(file.patch, 6000),
      ].join("\n");
    })
    .join("\n\n");

  const skippedCount = patchable.length - Math.min(patchable.length, 12);

  // 이번 구간(직전 리뷰 이후)의 커밋 메시지 = "무엇을 왜 바꿨고 어떻게 검증했는지"의 기록.
  const commitLog = rangeCommits
    .slice(0, 30)
    .map((c) => `- ${(c.message ?? "").split("\n")[0]}\n${truncate((c.message ?? "").split("\n").slice(1).join("\n").trim(), 1000)}`.trim())
    .join("\n");

  // 이전 리뷰 지적 + 답변 + resolved 여부 — 반복 방지용(답변을 반드시 보게 함).
  const priorLog = priorFindings
    .slice(0, 40)
    .map((f) => {
      const head = `- [${f.path}:${f.line ?? "?"}] (resolved: ${f.resolved ? "yes" : "no"})`;
      const finding = `  지적: ${truncate(f.finding, 400)}`;
      const replies =
        f.replies && f.replies.length > 0
          ? `  답변: ${truncate(f.replies.join(" / "), 700)}`
          : "  답변: (없음)";
      return [head, finding, replies].join("\n");
    })
    .join("\n");

  return [
    "이 Pull Request를 엄격한 시니어 엔지니어처럼 리뷰하라.",
    "버그, 회귀, 보안 문제, 깨진 UX 흐름, 누락된 가드만 다뤄라.",
    "스타일, 네이밍, 취향 차이 코멘트는 금지.",
    "반드시 patch 에서 실제로 바뀐 라인만 지적하라.",
    incremental
      ? "아래 FILES 는 '직전 리뷰 이후 새로 변경된 부분'이다. 이 증분만 리뷰하라."
      : "",
    "아래 '이미 처리된 지적'을 **반드시 먼저 확인**하라. 각 항목의 '답변'과 'resolved' 상태를 읽고, 이미 제기됐거나 답변/커밋으로 해결·기각·검증된 사항은 **절대 다시 지적하지 마라**.",
    "resolved: yes 이거나 답변이 달린 항목, 또는 답변/커밋이 '의도된 결정'·'사실오류'·'과설계라 미채택'·'이미 상한/방지됨'이라고 반박한 항목은 재지적 금지. 같은 파일의 같은 성격 유사 지적도 금지.",
    "이전 답변에 새 근거로 반박하고 싶어도 findings 에 넣지 말고 침묵하라(반복 루프 방지).",
    "P1(실제 버그·회귀·보안 취약점·데이터 손실)에만 집중하라. 스타일·프로세스·문서 정합성·정책 강제 여부 같은 메타 코멘트나 확신이 약한 지적은 findings 에 넣지 마라.",
    // 원문 대조(#155): 판정 기준은 원문. prd·sdd·PR 설명은 보조.
    "아래 '원래 요청(원문)'을 **판정 기준**으로 삼아, 변경 코드가 각 요구사항을 충족/누락/위반/판단불가 중 무엇인지 대조하라. PR 설명·커밋·prd·sdd는 보조 자료일 뿐이다.",
    "원문 요구가 코드에서 **누락되거나 위반**된 것만 P1 findings 로 보고하라(근거: 파일:라인). 구현된 요구를 다시 지적하지 마라.",
    "request.md(착수 시점 원문)와 연결 이슈 본문(최신)이 서로 다르면, 그것은 '요구 변경 확인 필요' 사항이다 — 최신 이슈로 기준을 임의로 교체하지 말고 findings 에 그 사실만 적어라.",
    "findings 는 최대 6개까지만 반환하라.",
    "액션 가능한 이슈가 없으면 findings 를 빈 배열로 반환하라.",
    "title 과 body 는 모두 한국어로 작성하라.",
    "",
    `PR TITLE: ${pr.title}`,
    `PR BODY:\n${pr.body ?? "(empty)"}`,
    "",
    "원래 요청(원문 — 판정 기준):",
    formatOriginalRequest(originalRequest),
    "",
    "이번 구간 커밋 메시지 (변경·검증·근거):",
    commitLog || "(없음)",
    "",
    "이미 처리된 지적 (제기·답변·resolved 완료 — 절대 반복 금지, 답변을 먼저 확인하라):",
    priorLog || "(없음)",
    "",
    incremental ? "FILES (직전 리뷰 이후 변경분):" : "FILES:",
    reviewedFiles || "(no patchable files)",
    skippedCount > 0 ? `\n${skippedCount} additional changed files were omitted for brevity.` : "",
  ].join("\n");
}
