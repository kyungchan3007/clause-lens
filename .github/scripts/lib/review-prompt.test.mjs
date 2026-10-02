import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReviewPrompt, formatOriginalRequest, parseChangedLines, truncate } from "./review-prompt.mjs";

const PR = { title: "T", body: "B" };
const FILES = [{ filename: "a.ts", status: "modified", additions: 1, deletions: 0, patch: "@@ -1 +1 @@\n+x" }];

// ── 원문 포맷(#155) ────────────────────────────────────────────
test("formatOriginalRequest — request.md=판정 기준, 이슈=최신 역할 구분", () => {
  const out = formatOriginalRequest({ issueNumber: 155, issueTitle: "원문 고정", issueBody: "이슈 본문", requestMd: "착수 원문" });
  assert.match(out, /request\.md.*판정의 기준/s);
  assert.match(out, /착수 원문/);
  assert.match(out, /연결 이슈 #155 — 원문 고정 \(최신/);
  assert.match(out, /이슈 본문/);
});

test("formatOriginalRequest — 둘 다 없으면 검증 한계 명시", () => {
  const out = formatOriginalRequest({});
  assert.match(out, /검증 한계/);
  assert.match(out, /원문 미확보/);
});

test("formatOriginalRequest — request.md만 있어도 됨", () => {
  const out = formatOriginalRequest({ requestMd: "원문만" });
  assert.match(out, /원문만/);
  assert.ok(!/검증 한계/.test(out));
});

// ── 프롬프트에 원문·대조 지시 포함 ─────────────────────────────
test("buildReviewPrompt — 원문 섹션과 대조 지시를 포함", () => {
  const prompt = buildReviewPrompt(PR, FILES, {
    originalRequest: { issueNumber: 155, issueBody: "요구 A·B", requestMd: "원문 A·B" },
  });
  assert.match(prompt, /원래 요청\(원문 — 판정 기준\):/);
  assert.match(prompt, /원문 A·B/);
  assert.match(prompt, /충족\/누락\/위반\/판단불가/);
  assert.match(prompt, /\*\*누락되거나 위반\*\*된 것만 P1/);
  assert.match(prompt, /요구 변경 확인 필요/);
});

test("buildReviewPrompt — originalRequest 없으면 검증 한계가 프롬프트에 들어감", () => {
  const prompt = buildReviewPrompt(PR, FILES, {});
  assert.match(prompt, /검증 한계/);
});

// ── 기존 순수 헬퍼 회귀 ────────────────────────────────────────
test("truncate — 한도 초과 시 자르고 표식", () => {
  assert.equal(truncate("abc", 10), "abc");
  assert.match(truncate("abcdef", 3), /^abc\n\.\.\. \[truncated\]$/);
});

test("parseChangedLines — + 라인의 새 파일 라인번호 수집", () => {
  const s = parseChangedLines("@@ -1,2 +1,2 @@\n ctx\n+added\n-removed");
  assert.deepEqual([...s], [2]);
});
