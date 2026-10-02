import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { decideEdit, inspectTaskFolder, isRequestPath, REQUEST_FILE } from "./records.mjs";
import { buildRequestContent, writeRequestOnce } from "../evals/request.mjs";

function tmpProject() {
  const root = mkdtempSync(join(tmpdir(), "cl-req-"));
  mkdirSync(join(root, "agents/intent/specs"), { recursive: true });
  mkdirSync(join(root, "agents/orchestration"), { recursive: true });
  return root;
}
function writeFolder(root, folder, files) {
  const dir = join(root, "agents/intent/specs", folder);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
}
const PRD = (issue) => `# x\n> **이슈:** #${issue}\n## Acceptance\n- [ ] a\n`;
const SDD = "## 접근\nx\n## 대안\ny\n## 검증\nz\n";

// ── isRequestPath ──────────────────────────────────────────────
test("isRequestPath — specs/<폴더>/request.md만 매칭", () => {
  assert.ok(isRequestPath("agents/intent/specs/0059-x/request.md"));
  assert.ok(!isRequestPath("agents/intent/specs/0059-x/prd.md"));
  assert.ok(!isRequestPath("agents/intent/specs/request.md")); // 폴더 없음
  assert.ok(!isRequestPath("docs/request.md"));
});

// ── buildRequestContent (순수) ─────────────────────────────────
test("buildRequestContent — 헤더(메타·불변 주석)+구분선+본문 전체, CRLF 정규화", () => {
  const out = buildRequestContent({
    issue: 155,
    body: "첫 줄\r\n둘째 줄\r\n\r\n",
    url: "https://github.com/o/r/issues/155",
    capturedAt: "2026-10-02",
  });
  assert.match(out, /원문 고정\(#155\).*수정 금지/); // 불변 주석
  assert.match(out, /# 원문 — 이슈 #155/);
  assert.match(out, /- 이슈: https:\/\/github\.com\/o\/r\/issues\/155/);
  assert.match(out, /- 캡처: 2026-10-02/);
  assert.match(out, /\n---\n첫 줄\n둘째 줄\n$/); // 구분선 뒤 본문(LF), 끝 공백 정리
  assert.ok(!out.includes("\r")); // CR 제거
});

test("buildRequestContent — url 없으면 #번호로 대체", () => {
  const out = buildRequestContent({ issue: 7, body: "b", url: "", capturedAt: "2026-10-02" });
  assert.match(out, /- 이슈: #7/);
});

// ── writeRequestOnce (불변 보호) ───────────────────────────────
test("writeRequestOnce — 없으면 생성, 있으면 덮어쓰지 않음", () => {
  const root = tmpProject();
  const path = join(root, "request.md");
  const r1 = writeRequestOnce(path, "원본\n");
  assert.equal(r1.created, true);
  assert.equal(readFileSync(path, "utf8"), "원본\n");
  const r2 = writeRequestOnce(path, "덮어쓰기 시도\n");
  assert.equal(r2.created, false);
  assert.equal(readFileSync(path, "utf8"), "원본\n"); // 보존
});

// ── decideEdit 불변성 ──────────────────────────────────────────
test("decideEdit — 이미 있는 request.md 수정은 차단(불변)", () => {
  const root = tmpProject();
  writeFolder(root, "0059-x", { "request.md": "원문\n" });
  const d = decideEdit(root, "agents/intent/specs/0059-x/request.md");
  assert.equal(d.allow, false);
  assert.match(d.reason, /원문 고정|불변/);
});

test("decideEdit — 아직 없는 request.md 최초 생성은 허용", () => {
  const root = tmpProject();
  mkdirSync(join(root, "agents/intent/specs/0059-x"), { recursive: true });
  const d = decideEdit(root, "agents/intent/specs/0059-x/request.md");
  assert.equal(d.allow, true); // 미존재 → 생성 허용(기록 경로)
});

// ── inspectTaskFolder 존재 강제(REQUEST_REQUIRED_FROM) ──────────
test("inspectTaskFolder — 0059+ 폴더에 request.md 없으면 문제로 잡음", () => {
  const root = tmpProject();
  writeFolder(root, "0059-x", { "prd.md": PRD(155), "sdd.md": SDD, "trace.md": "## 판단\n- 충분히 긴 실제 기록\n" });
  const problems = inspectTaskFolder(root, "0059-x");
  assert.ok(problems.some((p) => p.includes(REQUEST_FILE) && p.includes("없습니다")));
});

test("inspectTaskFolder — request.md 있으면 원문 문제 없음", () => {
  const root = tmpProject();
  writeFolder(root, "0059-x", {
    "prd.md": PRD(155),
    "sdd.md": SDD,
    "trace.md": "## 판단\n- 충분히 긴 실제 기록\n",
    "request.md": "# 원문\n내용\n",
  });
  const problems = inspectTaskFolder(root, "0059-x");
  assert.ok(!problems.some((p) => p.includes(REQUEST_FILE)));
});

test("inspectTaskFolder — 도입 전(0058 이하)은 request.md 면제", () => {
  const root = tmpProject();
  writeFolder(root, "0058-x", { "prd.md": PRD(154), "sdd.md": SDD, "trace.md": "## 판단\n- 충분히 긴 실제 기록\n" });
  const problems = inspectTaskFolder(root, "0058-x");
  assert.ok(!problems.some((p) => p.includes(REQUEST_FILE)));
});

test("inspectTaskFolder — request.md가 비어 있으면 문제로 잡음", () => {
  const root = tmpProject();
  writeFolder(root, "0059-x", {
    "prd.md": PRD(155),
    "sdd.md": SDD,
    "trace.md": "## 판단\n- 충분히 긴 실제 기록\n",
    "request.md": "   \n",
  });
  const problems = inspectTaskFolder(root, "0059-x");
  assert.ok(problems.some((p) => p.includes(REQUEST_FILE) && p.includes("비어")));
});
