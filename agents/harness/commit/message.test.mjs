import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMessage, insertSection, isExempt } from "./message.mjs";

const withSections = [
  "feat(#83): 커밋 규칙",
  "",
  "- 변경 요약",
  "",
  "[허점]",
  "- 훅은 --no-verify로 우회 가능",
  "",
  "[보완]",
  "- CI에서도 검사",
  "",
  "[컨텍스트·토큰]",
  "- 범위: 브랜치 x 누적 · 세션 1개",
  "",
  "Co-Authored-By: Claude <noreply@anthropic.com>",
].join("\n");

test("checkMessage — 세 섹션 모두 내용 있으면 통과", () => {
  assert.deepEqual(checkMessage(withSections), []);
});

test("checkMessage — 섹션 누락 감지", () => {
  const msg = "feat: x\n\n[허점]\n- a\n\n[보완]\n- b\n";
  assert.deepEqual(checkMessage(msg), ["[컨텍스트·토큰] 섹션이 없습니다"]);
});

test("checkMessage — 빈 섹션 감지 (제목만·플레이스홀더)", () => {
  const msg = "feat: x\n\n[허점]\n\n[보완]\n- (작성)\n\n[컨텍스트·토큰]\n- 범위: y\n";
  const problems = checkMessage(msg);
  assert.ok(problems.includes("[허점] 섹션이 비어 있습니다"));
  assert.ok(problems.includes("[보완] 섹션이 비어 있습니다")); // "(작성)" 플레이스홀더는 내용 아님
  assert.ok(!problems.some((p) => p.startsWith("[컨텍스트·토큰]")));
});

test("isExempt — Merge·fixup·squash·Revert 커밋은 면제", () => {
  assert.ok(isExempt("Merge pull request #86"));
  assert.ok(isExempt("fixup! feat: x"));
  assert.ok(isExempt('Revert "feat: x"'));
  assert.ok(!isExempt("feat: 일반 커밋"));
});

test("checkMessage — 면제 커밋은 섹션 없어도 통과", () => {
  assert.deepEqual(checkMessage("Merge branch develop"), []);
});

test("checkMessage — # 주석 줄은 무시", () => {
  const msg = "feat: x\n# [허점] 주석은 섹션 아님\n\n[허점]\n- a\n\n[보완]\n- b\n\n[컨텍스트·토큰]\n- c\n";
  assert.deepEqual(checkMessage(msg), []);
});

test("insertSection — 트레일러 앞에 [컨텍스트·토큰] 삽입", () => {
  const msg = "feat: x\n\n[허점]\n- a\n\n[보완]\n- b\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n";
  const out = insertSection(msg, "[컨텍스트·토큰]\n- 범위: z");
  assert.match(out, /\[컨텍스트·토큰\]\n- 범위: z\n\nCo-Authored-By:/);
});

test("insertSection — 이미 있으면 그대로", () => {
  assert.equal(insertSection(withSections, "[컨텍스트·토큰]\n- 새거"), withSections);
});
