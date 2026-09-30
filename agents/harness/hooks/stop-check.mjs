#!/usr/bin/env node
// Stop: 코드를 바꿨는데 기록(trace·prd·sdd·TASKS)이 비었으면 한 번 돌려보낸다.
import { checkBeforeStop } from "../lib/records.mjs";
import { appendTrace, toEntry } from "./trace.mjs";
import { isMain, projectDirOf, readHookInput, runHook } from "./lib/io.mjs";

if (isMain(import.meta.url)) {
  runHook("stop-check", async () => {
    const input = await readHookInput();
    const projectDir = projectDirOf(input);
    const problems = checkBeforeStop(projectDir);
    if (problems.length === 0) process.exit(0);

    // 이미 한 번 돌려보냈으면 다시 막지 않는다 (무한 반복 방지). 경고만 남긴다.
    if (input.stop_hook_active) {
      process.stderr.write(`[기록 강제] 기록이 아직 비어 있습니다:\n${problems.map((p) => `- ${p}`).join("\n")}\n`);
      process.exit(0);
    }
    const reason = `[기록 강제] 끝내기 전에 기록을 채우세요:\n${problems.map((p) => `- ${p}`).join("\n")}`;
    try {
      appendTrace(projectDir, { ...toEntry(input, projectDir), event: "StopBlocked", ok: false, blocked: true, error: problems.join(" / ").slice(0, 200) });
    } catch {}
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
    process.exit(0);
  });
}
