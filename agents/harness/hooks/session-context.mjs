#!/usr/bin/env node
// SessionStart: 현재 브랜치·이슈·기록 상태를 에이전트 컨텍스트로 알려주고, 복기를 주입한다 (stdout → 컨텍스트).
import { branchIssueNumber, currentBranch, folderForIssue, inspectTaskFolder, specForIssue, SPECS_DIR } from "../lib/records.mjs";
import { isMain, projectDirOf, readHookInput, runHook } from "./lib/io.mjs";

export function describeSession(projectDir) {
  const branch = currentBranch(projectDir);
  const issue = branchIssueNumber(branch);
  const lines = [`[기록 규칙] 현재 브랜치: ${branch || "알 수 없음"}`];

  if (!issue) {
    lines.push("이슈 브랜치가 아닙니다. 코드(기록 경로 밖)를 수정하려면 먼저 이슈 → gh issue develop <이슈> --base develop --name <접두사>/<이슈번호>-슬러그, TASKS.md 행, spec 폴더(prd·sdd)가 필요합니다. 없으면 수정이 차단됩니다. 지침: agents/harness/branch-and-issue.md");
    return lines.join("\n");
  }
  if (specForIssue(projectDir, issue)) {
    lines.push(`이슈 #${issue}: 단일 파일 spec(도입 전 형식) — 폴더 기록 규칙 면제.`);
    return lines.join("\n");
  }
  const folder = folderForIssue(projectDir, issue);
  if (!folder) {
    lines.push(`이슈 #${issue}: ${SPECS_DIR}/<번호>-슬러그/ 폴더가 없습니다. prd.md·sdd.md·trace.md를 먼저 작성하세요.`);
    return lines.join("\n");
  }
  const problems = inspectTaskFolder(projectDir, folder);
  lines.push(`이슈 #${issue} (${SPECS_DIR}/${folder}/)`);
  lines.push(problems.length === 0 ? "기록 상태: 정상. 작업하며 trace.md에 판단·이유를 계속 남기세요." : `기록 상태: 미완\n${problems.map((p) => `- ${p}`).join("\n")}`);
  return lines.join("\n");
}

if (isMain(import.meta.url)) {
  runHook("session-context", async () => {
    const input = await readHookInput();
    const projectDir = projectDirOf(input);
    // 대화 시작에도 복기를 넣고, 같은 날·같은 브랜치의 첫 요청에서 반복하지 않도록 상태를 기록한다
    const { recallOnPrompt } = await import("./recall-hook.mjs");
    const recap = recallOnPrompt(projectDir, String(input.session_id ?? "unknown"));
    if (recap) {
      try {
        const { appendTrace, toEntry } = await import("./trace.mjs");
        appendTrace(projectDir, { ...toEntry(input, projectDir), event: "RecallInjected", detail: `대화 시작 · 보완 ${recap.followups}개 · 일지 ${recap.journal}개` });
      } catch {}
    }
    process.stdout.write((recap ? recap.text : describeSession(projectDir)) + "\n");
    process.exit(0);
  });
}
