#!/usr/bin/env node
// PreToolUse(Edit·Write·MultiEdit·NotebookEdit): 기록(이슈 브랜치·spec 폴더 prd·sdd) 없이 코드 수정을 막는다. 차단은 exit 2.
import { relative } from "node:path";
import { decideEdit } from "../lib/records.mjs";
import { appendTrace, toEntry } from "./trace.mjs";
import { isMain, projectDirOf, readHookInput, runHook } from "./lib/io.mjs";

if (isMain(import.meta.url)) {
  runHook("guard", async () => {
    const input = await readHookInput();
    const projectDir = projectDirOf(input);
    const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    if (!target) process.exit(0);

    const decision = decideEdit(projectDir, relative(projectDir, target));
    if (decision.allow) process.exit(0);
    // 차단된 호출은 PostToolUse가 오지 않으므로 여기서 자동 기록에 남긴다
    try {
      appendTrace(projectDir, toEntry({ ...input, reason: decision.reason.split("\n")[0] }, projectDir));
    } catch {}
    process.stderr.write(decision.reason + "\n");
    process.exit(2);
  });
}
