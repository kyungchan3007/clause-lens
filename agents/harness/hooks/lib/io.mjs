// Claude Code hook 공용 입출력. 예상 못 한 오류는 작업을 막지 않도록 exit 0 으로 끝낸다.
import { pathToFileURL } from "node:url";

export async function readHookInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw || "{}");
}

export function projectDirOf(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

export function isMain(metaUrl) {
  return metaUrl === pathToFileURL(process.argv[1] ?? "").href;
}

export function runHook(name, fn) {
  fn().catch((error) => {
    process.stderr.write(`[${name}] 내부 오류(작업은 계속됨): ${error?.message ?? error}\n`);
    process.exit(0);
  });
}
