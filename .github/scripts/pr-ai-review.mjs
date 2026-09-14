const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  OPENAI_API_KEY,
  OPENAI_MODEL = "gpt-5-mini",
  PR_NUMBER,
} = process.env;

if (!GITHUB_TOKEN) {
  throw new Error("Missing GITHUB_TOKEN.");
}

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY secret.");
}

if (!GITHUB_REPOSITORY || !PR_NUMBER) {
  throw new Error("Missing GITHUB_REPOSITORY or PR_NUMBER.");
}

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const prNumber = Number.parseInt(PR_NUMBER, 10);

if (!owner || !repo || Number.isNaN(prNumber)) {
  throw new Error("Invalid repository or pull request number.");
}

const githubHeaders = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "clause-lens-pr-ai-review",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function githubRequest(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...githubHeaders,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${body}`);
  }

  return response.status === 204 ? null : response.json();
}

async function githubPaginate(path) {
  const items = [];
  let page = 1;

  while (true) {
    const batch = await githubRequest(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return items;
}

function truncate(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... [truncated]`;
}

function parseChangedLines(patch) {
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

function buildReviewPrompt(pr, files, { incremental, rangeCommits = [], priorFindings = [] } = {}) {
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

  // 이전에 이미 남긴 AI 리뷰 지적 — 반복 방지용.
  const priorLog = priorFindings
    .slice(0, 40)
    .map((f) => `- [${f.path}:${f.line}] ${truncate(f.body, 500)}`)
    .join("\n");

  return [
    "이 Pull Request를 엄격한 시니어 엔지니어처럼 리뷰하라.",
    "버그, 회귀, 보안 문제, 깨진 UX 흐름, 누락된 가드만 다뤄라.",
    "스타일, 네이밍, 취향 차이 코멘트는 금지.",
    "반드시 patch 에서 실제로 바뀐 라인만 지적하라.",
    incremental
      ? "아래 FILES 는 '직전 리뷰 이후 새로 변경된 부분'이다. 이 증분만 리뷰하라."
      : "",
    "아래 '이전 리뷰 지적'에서 이미 제기됐거나, '이번 구간 커밋 메시지'에서 근거를 들어 해결/기각·검증한 사항은 다시 지적하지 마라.",
    "커밋 메시지가 특정 지적을 '의도된 결정' 또는 '사실오류'로 반박했다면 존중하고 반복하지 마라.",
    "P1(실제 버그·회귀·보안 취약점·데이터 손실)에만 집중하라. 스타일·프로세스·문서 정합성·정책 강제 여부 같은 메타 코멘트나 확신이 약한 지적은 findings 에 넣지 마라.",
    "findings 는 최대 6개까지만 반환하라.",
    "액션 가능한 이슈가 없으면 findings 를 빈 배열로 반환하라.",
    "title 과 body 는 모두 한국어로 작성하라.",
    "",
    `PR TITLE: ${pr.title}`,
    `PR BODY:\n${pr.body ?? "(empty)"}`,
    "",
    "이번 구간 커밋 메시지 (변경·검증·근거):",
    commitLog || "(없음)",
    "",
    "이전 리뷰 지적 (이미 논의/해결됨 — 반복 금지):",
    priorLog || "(없음)",
    "",
    incremental ? "FILES (직전 리뷰 이후 변경분):" : "FILES:",
    reviewedFiles || "(no patchable files)",
    skippedCount > 0 ? `\n${skippedCount} additional changed files were omitted for brevity.` : "",
  ].join("\n");
}

async function requestOpenAIReview(prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: "당신은 GitHub Pull Request 리뷰어다. 결과는 간결한 한국어로 작성하고, 고신호 이슈만 보고한다.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pr_review_findings",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              findings: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    path: { type: "string" },
                    line: { type: "integer" },
                    severity: { type: "string", enum: ["P1", "P2", "P3"] },
                    title: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["path", "line", "severity", "title", "body"],
                },
              },
            },
            required: ["findings"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API ${response.status} ${response.statusText}: ${body}`);
  }

  const json = await response.json();
  const outputText = extractResponseText(json);
  if (!outputText) {
    throw new Error("OpenAI response did not include parseable text.");
  }

  return parseReviewJson(outputText);
}

function extractResponseText(responseJson) {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.length > 0) {
    return responseJson.output_text;
  }

  if (!Array.isArray(responseJson.output)) {
    return null;
  }

  const chunks = [];

  for (const item of responseJson.output) {
    if (!Array.isArray(item.content)) continue;

    for (const contentItem of item.content) {
      if (typeof contentItem.text === "string" && contentItem.text.length > 0) {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n") : null;
}

function parseReviewJson(outputText) {
  try {
    return JSON.parse(outputText);
  } catch {
    const jsonBlock = extractJsonBlock(outputText);
    if (!jsonBlock) {
      throw new Error("OpenAI review output was not valid JSON.");
    }

    try {
      return JSON.parse(jsonBlock);
    } catch {
      throw new Error("OpenAI review output contained text, but the JSON block could not be parsed.");
    }
  }
}

function extractJsonBlock(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

async function main() {
  const pr = await githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}`);

  if (pr.draft) {
    console.log("Draft PR detected. Skipping review.");
    return;
  }

  const marker = `<!-- ai-pr-review:${pr.head.sha} -->`;
  const existingReviews = await githubPaginate(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`);
  if (existingReviews.some((review) => typeof review.body === "string" && review.body.includes(marker))) {
    console.log(`Review already exists for head SHA ${pr.head.sha}.`);
    return;
  }

  // 직전에 리뷰한 커밋 sha를 이전 리뷰 마커에서 추출(가장 최근 것).
  const markerRe = /<!-- ai-pr-review:([0-9a-f]{7,40}) -->/;
  const reviewedShas = existingReviews
    .filter((r) => typeof r.body === "string")
    .map((r) => ({ at: r.submitted_at ?? "", sha: r.body.match(markerRe)?.[1] }))
    .filter((r) => r.sha && r.sha !== pr.head.sha)
    .sort((a, b) => a.at.localeCompare(b.at));
  const lastReviewedSha = reviewedShas.length ? reviewedShas[reviewedShas.length - 1].sha : null;

  // 인라인 코멘트 유효성은 항상 PR 전체 diff(base…head) 기준으로 검사한다.
  const files = await githubPaginate(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);
  const changedLineMap = new Map(
    files.map((file) => [file.filename, parseChangedLines(file.patch)]),
  );

  // 문서 전용 PR(모든 변경 파일이 .md/.mdx)은 코드 리뷰가 무의미 → OpenAI 호출 없이 스킵.
  const prPatchable = files.filter((f) => f.patch && f.status !== "removed");
  const docsOnly = prPatchable.length > 0 && prPatchable.every((f) => /\.mdx?$/i.test(f.filename));
  if (docsOnly) {
    await githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        event: "COMMENT",
        body: [marker, "문서 전용 PR(모든 변경이 .md)이라 AI 코드 리뷰를 건너뜁니다."].join("\n\n"),
      }),
    });
    console.log("Docs-only PR. Skipping code review.");
    return;
  }

  // 리뷰 대상 결정: 직전 리뷰 sha가 있으면 그 이후 증분만(compare API), 아니면 PR 전체.
  let reviewFiles = files;
  let rangeCommits = [];
  let incremental = false;
  if (lastReviewedSha) {
    try {
      const cmp = await githubRequest(
        `/repos/${owner}/${repo}/compare/${lastReviewedSha}...${pr.head.sha}`,
      );
      if (cmp && Array.isArray(cmp.files) && (cmp.status === "ahead" || cmp.status === "identical")) {
        reviewFiles = cmp.files;
        rangeCommits = Array.isArray(cmp.commits) ? cmp.commits.map((c) => c.commit) : [];
        incremental = true;
        console.log(`Incremental review: ${reviewFiles.length} file(s) since ${lastReviewedSha.slice(0, 7)}.`);
      } else {
        console.log(`Compare status='${cmp?.status}' — full review로 fallback.`);
      }
    } catch (e) {
      console.log(`Compare 실패(${e.message}) — full review로 fallback.`);
    }
  }
  if (!incremental) {
    const prCommits = await githubPaginate(`/repos/${owner}/${repo}/pulls/${prNumber}/commits`);
    rangeCommits = prCommits.map((c) => c.commit);
  }

  // 증분 리뷰인데 새로 리뷰할 패치가 없으면 종료(마커만 남김).
  const patchable = reviewFiles.filter((f) => f.patch && f.status !== "removed");
  if (incremental && patchable.length === 0) {
    await githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        event: "COMMENT",
        body: [marker, "직전 리뷰 이후 새로 변경된 코드가 없어 추가 리뷰를 건너뜁니다."].join("\n\n"),
      }),
    });
    console.log("No new changes since last review.");
    return;
  }

  // 이전 AI 리뷰가 남긴 인라인 코멘트(반복 방지용 맥락).
  let priorFindings = [];
  try {
    const priorComments = await githubPaginate(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`);
    priorFindings = priorComments
      .filter((c) => typeof c.body === "string" && /\*\*P[123]\s/.test(c.body))
      .map((c) => ({ path: c.path, line: c.line ?? c.original_line, body: c.body }));
  } catch (e) {
    console.log(`이전 코멘트 조회 실패(${e.message}) — 맥락 없이 진행.`);
  }

  const prompt = buildReviewPrompt(pr, reviewFiles, { incremental, rangeCommits, priorFindings });
  const result = await requestOpenAIReview(prompt);

  const inlineComments = [];
  const rejectedFindings = [];
  let droppedBySeverity = 0;

  for (const finding of result.findings ?? []) {
    // P1(실제 버그·회귀·보안·데이터 손실)만 인라인. P2/P3 잔소리는 노이즈라 드롭.
    if (finding.severity !== "P1") {
      droppedBySeverity += 1;
      continue;
    }

    const validLines = changedLineMap.get(finding.path);
    if (!validLines || !validLines.has(finding.line)) {
      rejectedFindings.push(finding);
      continue;
    }

    inlineComments.push({
      path: finding.path,
      line: finding.line,
      side: "RIGHT",
      body: `**${finding.severity} ${finding.title}**\n${finding.body}`,
    });
  }

  const summaryLines = [marker, "Automated PR review completed."];

  if (inlineComments.length === 0) {
    summaryLines.push("남길 P1(버그·회귀·보안) 이슈가 없었습니다.");
  } else {
    summaryLines.push(`${inlineComments.length}개의 P1 리뷰 코멘트를 인라인으로 남겼습니다.`);
  }

  if (droppedBySeverity > 0) {
    summaryLines.push(`${droppedBySeverity}개의 P2/P3 finding은 노이즈 감소를 위해 인라인에서 제외했습니다.`);
  }

  if (rejectedFindings.length > 0) {
    summaryLines.push(`${rejectedFindings.length}개의 finding은 변경된 라인에 매핑되지 않아 제외했습니다.`);
  }

  await githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
    method: "POST",
    body: JSON.stringify({
      event: "COMMENT",
      body: summaryLines.join("\n\n"),
      comments: inlineComments,
    }),
  });

  console.log(`Posted review with ${inlineComments.length} inline comment(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
