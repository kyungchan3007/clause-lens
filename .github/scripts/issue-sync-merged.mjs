// A(#183): PR 머지 시 이슈 완료 조건을 합쳐진 spec의 Acceptance 상태로 미러한다.
// 사람 개입 0. Action은 거울 — spec 체크 "상태"만 복사(없는 체크 안 만듦). 판정·차단은 B'(PR 시점).
// 보안: 워크플로가 base/merge_commit_sha를 체크아웃(fork head 코드 실행 금지). 여기선 그 트리의 spec만 읽는다.
import { makeGithub } from "./lib/github.mjs";
import { branchIssueNumber } from "../../agents/harness/lib/records.mjs";
import { syncIssueFromSpec } from "../../agents/harness/evals/issue-sync.mjs";

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER } = process.env;
if (!GITHUB_REPOSITORY || !PR_NUMBER) throw new Error("Missing GITHUB_REPOSITORY or PR_NUMBER.");
const [owner, repo] = GITHUB_REPOSITORY.split("/");
const gh = makeGithub(GITHUB_TOKEN);
const projectDir = process.cwd();

async function resolveIssue(pr) {
  // 1차(권위): head 브랜치명 → 이슈 번호. (spec도 브랜치-이슈로 키된다)
  const headRef = pr.head?.ref ?? "";
  const byBranch = branchIssueNumber(headRef);
  // 대조: GitHub가 아는 연결(키워드 없이 Development 패널 연결까지).
  let linked = [];
  try {
    const data = await gh.graphql(
      `query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ pullRequest(number:$n){ closingIssuesReferences(first:10){ nodes { number } } } } }`,
      { o: owner, r: repo, n: Number(PR_NUMBER) },
    );
    linked = (data?.repository?.pullRequest?.closingIssuesReferences?.nodes ?? []).map((x) => String(x.number));
  } catch (e) {
    console.log(`연결 조회 실패(무시): ${e.message}`);
  }
  let issue = byBranch ?? (linked.length === 1 ? linked[0] : undefined);
  if (issue && linked.length && !linked.includes(String(issue))) {
    console.log(`주의: 브랜치 이슈 #${issue}가 연결(${linked.join(",")})과 불일치 — 브랜치 기준 진행`);
  }
  return { issue, headRef };
}

async function main() {
  const pr = await gh.request(`/repos/${owner}/${repo}/pulls/${PR_NUMBER}`);
  if (!pr.merged) {
    console.log(`PR #${PR_NUMBER} 머지 아님 — 건너뜀`);
    return;
  }
  const { issue, headRef } = await resolveIssue(pr);
  if (!issue) {
    console.log(`브랜치 ${headRef}·연결에서 이슈 번호를 못 찾음 — no-op`);
    return;
  }
  const issueData = await gh.request(`/repos/${owner}/${repo}/issues/${issue}`);
  const r = syncIssueFromSpec({ projectDir, issueNumber: issue, issueBody: issueData.body ?? "", mode: "sync" });
  if (!r.ok && (r.code === "no_spec" || r.code === "no_checkbox")) {
    console.log(`#${issue}: ${r.message} — spec으로 해석 안 됨, 편집 안 함`);
    return;
  }
  if (r.code === "unchanged") {
    console.log(`#${issue} 이미 spec과 같음`);
    return;
  }
  await gh.request(`/repos/${owner}/${repo}/issues/${issue}`, { method: "PATCH", body: JSON.stringify({ body: r.nextBody }) });
  await gh.request(`/repos/${owner}/${repo}/issues/${issue}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: `PR #${PR_NUMBER} 머지 시점 완료 조건 동기화 — ${r.specName} 기준 ${r.checked}/${r.total} 체크 (자동, #183)` }),
  });
  console.log(`#${issue} 완료 조건을 ${r.specName}에 미러 (${r.checked}/${r.total})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
