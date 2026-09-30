#!/usr/bin/env node
// UserPromptSubmit: 이 대화에서 날짜나 브랜치가 바뀐 첫 요청이면 복기를 컨텍스트로 넣는다 (stdout → 컨텍스트).
import { buildRecap, readState, shouldInject, today, writeState } from "./lib/recall.mjs";
import { currentBranch } from "../lib/records.mjs";
import { isMain, projectDirOf, readHookInput, runHook } from "./lib/io.mjs";
import { describeSession } from "./session-context.mjs";
import { appendTrace, toEntry } from "./trace.mjs";

export function recallOnPrompt(projectDir, session, { date = today(), branch = currentBranch(projectDir) } = {}) {
  const state = readState(projectDir);
  if (!shouldInject(state, session, date, branch)) return undefined;
  const recap = buildRecap(projectDir, describeSession(projectDir));
  state[session] = { date, branch };
  writeState(projectDir, state);
  return recap;
}

if (isMain(import.meta.url)) {
  runHook("recall", async () => {
    const input = await readHookInput();
    const projectDir = projectDirOf(input);
    const recap = recallOnPrompt(projectDir, String(input.session_id ?? "unknown"));
    if (!recap) process.exit(0);
    try {
      appendTrace(projectDir, { ...toEntry(input, projectDir), event: "RecallInjected", detail: `보완 ${recap.followups}개 · 일지 ${recap.journal}개` });
    } catch {}
    process.stdout.write(recap.text + "\n");
    process.exit(0);
  });
}
