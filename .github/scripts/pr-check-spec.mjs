// B'(#183): PR 시점 spec 준비성 검사. 사유 없는 미체크(#116/#169 신호)가 있으면 코멘트 + 실패.
// TASKS·doneSpecIds 비의존 — 그 PR의 이슈→spec을 직접 집어 봐서 0040류(TASKS 행 없음) 갭을 닫는다.
// 사유 있는 미체크(REASON_MARK)는 통과 — 머지 후 검증 항목의 탈출구.
import { makeGithub } from "./lib/github.mjs";
import { branchIssueNumber, inspectSpecReadiness } from "../../agents/harness/lib/records.mjs";

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER } = process.env;
if (!GITHUB_REPOSITORY || !PR_NUMBER) throw new Error("Missing GITHUB_REPOSITORY or PR_NUMBER.");
const [owner, repo] = GITHUB_REPOSITORY.split("/");
const gh = makeGithub(GITHUB_TOKEN);

async function main() {
  const pr = await gh.request(`/repos/${owner}/${repo}/pulls/${PR_NUMBER}`);
  const headRef = pr.head?.ref ?? "";
  const issue = branchIssueNumber(headRef);
  if (!issue) {
    console.log(`비작업 브랜치(${headRef || "-"}) — spec 준비성 검사 생략`);
    return;
  }
  const r = inspectSpecReadiness(process.cwd(), issue);
  if (r.ok) {
    console.log(`✅ #${issue} ${r.specName ?? ""} spec 준비 OK`);
    return;
  }
  const body = [
    `**spec 준비성 검사 실패 (#${issue}${r.specName ? ` · ${r.specName}` : ""})**`,
    "",
    ...r.problems.map((p) => `- ${p}`),
    "",
    `완료 전이면 해당 줄에 사유(\`#${issue}\`·\`→\`·\`후속\`·\`범위 밖\` 등)를 달거나 체크하세요. (B' — #183)`,
  ].join("\n");
  try {
    await gh.request(`/repos/${owner}/${repo}/issues/${PR_NUMBER}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  } catch (e) {
    console.log(`코멘트 실패(무시, fork 읽기 토큰일 수 있음): ${e.message}`);
  }
  console.error(`spec 준비성 실패(#${issue}): ${r.problems.join(" / ")}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
