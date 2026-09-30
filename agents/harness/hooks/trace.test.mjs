import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { redact, resolveTraceFile, sanitize, toEntry, UNASSIGNED_FILE } from "./trace.mjs";

test("redact — 비밀값 가림", () => {
  assert.match(redact("token=abcdef123456"), /token=\[REDACTED\]/);
  assert.match(redact("Bearer abc.def.ghi"), /Bearer \[REDACTED\]/);
  assert.match(redact("key ghp_ABCDEFGH12345678"), /\[REDACTED\]/);
  assert.equal(redact("평범한 텍스트"), "평범한 텍스트");
});

test("sanitize — 프로젝트/홈 경로 상대화 + 길이 제한", () => {
  const out = sanitize("/proj/apps/mobile/x.ts 를 읽음", "/proj", "/home");
  assert.match(out, /apps\/mobile\/x\.ts/);
  assert.ok(!out.includes("/proj/apps"));
  assert.ok(sanitize("a".repeat(500), "/proj").endsWith("…"));
});

test("toEntry — PreToolUse는 blocked, PostToolUse는 ok, 도구 결과 미포함", () => {
  const pre = toEntry({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "/proj/apps/x.ts" }, reason: "차단 사유", session_id: "abcdef1234" }, "/proj");
  assert.equal(pre.event, "PreToolUse");
  assert.equal(pre.tool, "Edit");
  assert.equal(pre.blocked, true);
  assert.equal(pre.ok, false);
  assert.equal(pre.session, "abcdef12");
  const post = toEntry({ hook_event_name: "PostToolUse", tool_name: "Read", tool_input: { file_path: "/proj/a.ts" } }, "/proj");
  assert.equal(post.ok, true);
  assert.ok(!("result" in post) && !("output" in post)); // 도구 결과는 저장 안 함
});

test("toEntry — UserPromptSubmit은 프롬프트를 sanitize", () => {
  const e = toEntry({ hook_event_name: "UserPromptSubmit", prompt: "token=secret123456 로 해줘" }, "/proj");
  assert.equal(e.event, "UserPromptSubmit");
  assert.match(e.detail, /\[REDACTED\]/);
});

test("resolveTraceFile — 이슈 폴더 있으면 폴더, 없으면 미배정", () => {
  const root = mkdtempSync(join(tmpdir(), "cl-trace-"));
  mkdirSync(join(root, "agents/intent/specs/0025-a"), { recursive: true });
  writeFileSync(join(root, "agents/intent/specs/0025-a/prd.md"), "# 0025\n> **이슈:** #84\n");
  assert.equal(resolveTraceFile(root, "chore/84-x"), "agents/intent/specs/0025-a/trace.auto.jsonl");
  assert.equal(resolveTraceFile(root, "chore/999-none"), UNASSIGNED_FILE);
  assert.equal(resolveTraceFile(root, "develop"), UNASSIGNED_FILE);
});
