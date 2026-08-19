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

function buildReviewPrompt(pr, files) {
  const reviewedFiles = files
    .filter((file) => file.patch && file.status !== "removed")
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

  const skippedCount = files.filter((file) => file.patch && file.status !== "removed").length - Math.min(
    files.filter((file) => file.patch && file.status !== "removed").length,
    12,
  );

  return [
    "Review this pull request like a strict senior engineer.",
    "Focus only on actionable bugs, regressions, security issues, broken UX flows, and missing safeguards.",
    "Do not comment on style, naming, or preferences.",
    "Only reference lines that are changed in the patch.",
    "Return at most 6 findings.",
    "If there are no actionable findings, return an empty findings array.",
    "",
    `PR TITLE: ${pr.title}`,
    `PR BODY:\n${pr.body ?? "(empty)"}`,
    "",
    "FILES:",
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
              text: "You produce concise GitHub pull request review findings. Only report high-signal issues.",
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
  if (!json.output_text) {
    throw new Error("OpenAI response did not include output_text.");
  }

  return JSON.parse(json.output_text);
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

  const files = await githubPaginate(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);
  const changedLineMap = new Map(
    files.map((file) => [file.filename, parseChangedLines(file.patch)]),
  );

  const prompt = buildReviewPrompt(pr, files);
  const result = await requestOpenAIReview(prompt);

  const inlineComments = [];
  const rejectedFindings = [];

  for (const finding of result.findings ?? []) {
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
    summaryLines.push("No actionable findings on changed lines.");
  } else {
    summaryLines.push(`${inlineComments.length} actionable finding(s) posted inline.`);
  }

  if (rejectedFindings.length > 0) {
    summaryLines.push(`${rejectedFindings.length} finding(s) were dropped because they did not map to changed lines.`);
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
