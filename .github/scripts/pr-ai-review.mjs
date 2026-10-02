import { buildReviewPrompt, parseChangedLines } from "./lib/review-prompt.mjs";

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

async function githubGraphQL(query, variables) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...githubHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub GraphQL ${response.status} ${response.statusText}: ${body}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
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

// 원문 고정(#155): 리뷰 판정 기준이 되는 "원래 요청"을 수집한다.
// - 연결 이슈 본문: closingIssuesReferences(GraphQL) → 실패 시 브랜치명(#번호)로 폴백.
// - request.md: PR 변경 파일에서 경로를 찾아 head SHA의 내용을 조회.
// 모두 best-effort — 실패해도 리뷰는 계속되고, 프롬프트에서 "검증 한계"로 표시된다.
// repo 좌표(owner·repo·prNumber)는 **명시적 인자**로 받는다(모듈 상수 클로저 의존 제거 — 주입 가능·테스트 용이).
async function fetchOriginalRequest({ owner, repo, prNumber } = {}, pr, files) {
  const result = { issueNumber: null, issueTitle: "", issueBody: "", requestMd: "" };

  // 1) 연결 이슈
  try {
    const data = await githubGraphQL(
      `query($owner:String!,$repo:String!,$pr:Int!){
        repository(owner:$owner,name:$repo){
          pullRequest(number:$pr){
            closingIssuesReferences(first:5){ nodes{ number title body } }
          }
        }
      }`,
      { owner, repo, pr: prNumber },
    );
    const nodes = data?.repository?.pullRequest?.closingIssuesReferences?.nodes ?? [];
    if (nodes.length > 0) {
      result.issueNumber = nodes[0].number;
      result.issueTitle = nodes[0].title ?? "";
      result.issueBody = nodes[0].body ?? "";
    }
  } catch (e) {
    console.log(`연결 이슈(GraphQL) 조회 실패(${e.message}) — 브랜치명으로 폴백.`);
  }
  // 폴백: 브랜치명에서 이슈 번호 추출(예: feat/155-slug).
  if (!result.issueNumber) {
    const m = /(?:^|\/)(\d+)-/.exec(pr.head?.ref ?? "");
    if (m) {
      try {
        const issue = await githubRequest(`/repos/${owner}/${repo}/issues/${m[1]}`);
        result.issueNumber = issue.number;
        result.issueTitle = issue.title ?? "";
        result.issueBody = issue.body ?? "";
      } catch (e) {
        console.log(`이슈 #${m[1]} 조회 실패(${e.message}).`);
      }
    }
  }

  // 2) request.md — PR 변경 파일에서 경로를 찾아 head SHA 내용 조회.
  try {
    const reqFile = (files ?? []).find((f) => /^agents\/intent\/specs\/[^/]+\/request\.md$/.test(f.filename));
    if (reqFile) {
      const content = await githubRequest(
        `/repos/${owner}/${repo}/contents/${encodeURI(reqFile.filename)}?ref=${pr.head.sha}`,
      );
      if (content?.content) {
        result.requestMd = Buffer.from(content.content, content.encoding || "base64").toString("utf8");
      }
    }
  } catch (e) {
    console.log(`request.md 조회 실패(${e.message}).`);
  }

  return result;
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

  // 이전 리뷰 스레드 — 지적 + **답변(반박·근거) + resolved 여부**까지 읽어 반복 지적 방지(핵심).
  // (기존엔 지적 본문만 넣어 답변을 못 봐서 같은 지적을 계속 반복했음.)
  const isBot = (author) =>
    author?.__typename === "Bot" ||
    /\[bot\]$/i.test(author?.login ?? "") ||
    (author?.login ?? "").toLowerCase() === "github-actions";
  let priorFindings = [];
  try {
    // reviewThreads·comments 페이지네이션으로 완전 수집(누락 시 반복 지적 발생).
    const threads = [];
    let cursor = null;
    for (let i = 0; i < 20; i += 1) {
      const data = await githubGraphQL(
        `query($owner:String!,$repo:String!,$pr:Int!,$cursor:String){
          repository(owner:$owner,name:$repo){
            pullRequest(number:$pr){
              reviewThreads(first:100, after:$cursor){
                pageInfo{ hasNextPage endCursor }
                nodes{
                  isResolved
                  path
                  line
                  comments(first:100){ nodes{ body author{ login __typename } } }
                }
              }
            }
          }
        }`,
        { owner, repo, pr: prNumber, cursor },
      );
      const conn = data?.repository?.pullRequest?.reviewThreads;
      threads.push(...(conn?.nodes ?? []));
      if (!conn?.pageInfo?.hasNextPage) break;
      cursor = conn.pageInfo.endCursor;
    }
    priorFindings = threads
      .map((t) => {
        const comments = t.comments?.nodes ?? [];
        // 원본 지적은 반드시 봇(액션) 작성 코멘트 기준으로 선택(답변을 지적으로 오인 방지).
        const botComments = comments.filter((c) => isBot(c.author));
        const finding =
          botComments.find((c) => /\*\*P[123]\s/.test(c.body ?? ""))?.body ??
          botComments[0]?.body ??
          comments[0]?.body ??
          "";
        // 봇이 아닌 코멘트 = 유지보수자 답변(반박·근거).
        const replies = comments
          .filter((c) => !isBot(c.author))
          .map((c) => (c.body ?? "").replace(/_🤖 Addressed by[\s\S]*$/i, "").trim())
          .filter(Boolean);
        return { path: t.path, line: t.line, resolved: !!t.isResolved, finding, replies };
      })
      .filter((f) => f.finding);
  } catch (e) {
    console.log(`이전 스레드(답변/resolved) 조회 실패(${e.message}) — 맥락 없이 진행.`);
  }

  // 원문 고정(#155): 연결 이슈 본문·request.md를 판정 기준 원문으로 수집해 프롬프트에 포함.
  const originalRequest = await fetchOriginalRequest({ owner, repo, prNumber }, pr, files);
  const prompt = buildReviewPrompt(pr, reviewFiles, { incremental, rangeCommits, priorFindings, originalRequest });
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
