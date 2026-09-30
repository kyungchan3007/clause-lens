# 0024 — 커밋 기록 규칙 (하네스 이식 2/4)

> **관련 태스크**: #83 (chore) · **상태**: in-progress · **유형**: chore (하네스/거버넌스)
> **depends**: [0023](0023-issue-checkbox-enforcement.md)(records.mjs 공용) · harness-lab 원본(commit/message·usage·githooks·commit-and-issue)
> **unblocks**: 이식 4/4(#85 복기 주입)가 커밋 `[보완]`을 읽음
> **핵심 결정**: git hook(셸 심 → `.mjs`)으로 커밋 세 섹션 강제 · `[컨텍스트·토큰]`은 Claude transcript에서 자동 기입 · Codex 커밋은 "집계 불가"(검사는 적용, 막지 않음) · base=develop.

## PRD (왜/무엇)

### 1. 문제
작업하며 드러난 **허점**, **보완할 점**, **컨텍스트·토큰 사용량**이 커밋·이슈·PR에 남지 않는다. 코드 diff만으론 "무엇이 약했고 얼마나 들었는지"를 알 수 없다. harness-lab에서 검증한 커밋 규칙을 옮긴다. git hook이라 **Claude·Codex 커밋 모두**에 적용된다.

### 2. 목표
- G1. 작업 브랜치 커밋에 `[허점]`·`[보완]`·`[컨텍스트·토큰]` 세 섹션이 없거나 비면 **커밋 거부**(머지·fixup·revert 제외).
- G2. `[컨텍스트·토큰]`을 Claude Code transcript에서 **실측 자동 기입**(같은 응답 중복 제거).
- G3. `pnpm install`만으로 git hook 설정(`core.hooksPath=.githooks`).
- G4. 이슈·PR 템플릿에 세 섹션.
- G5. 지침서 + AGENTS.md 규칙 등록.

### 3. 목표가 아닌 것 (Non-goals)
- N1. 읽은 파일 수(trace) 집계 — 과정 기록 시스템은 이식 3/4(#84).
- N2. CI에서의 PR 커밋 메시지 검사(#22). 이번은 로컬 hook만.
- N3. Codex 토큰 실측(대화 기록 형식이 Claude 전용) → "집계 불가"로 표시.

### 4. 제약 (Constraints)
- ClauseLens 루트는 `type:module`이 아님 → 확장자 없는 ESM 훅 대신 **셸 심 + `.mjs`**.
- 의존성 추가 없이 Node 내장(node:test). base=develop.

### Acceptance
- [x] 작업 브랜치 커밋에 세 섹션이 없거나 비면 거부, 머지·fixup·revert 제외. (commit-msg 훅 · 직접 실측 exit 1)
- [x] `[컨텍스트·토큰]` 자동 기입 (Claude 실측, 같은 message.id 중복 제거). (이 태스크 커밋에서 자동 기입 확인)
- [x] 새로 받은 저장소에서 `pnpm install`만으로 git hook 설정(`prepare`). (`prepare`=`git config core.hooksPath .githooks`)
- [x] 이슈 템플릿(*.yml) + PR 템플릿에 세 섹션. (6개 폼 + pull_request_template.md)
- [x] 지침서(commit-and-issue.md) + AGENTS.md 규칙 등록. (§1 규칙 5)
- [x] 단위 테스트 + 실제 git commit으로 거부·자동 기입 확인. (node:test 14개 + 실측)

## SDD (어떻게)

### 1. 접근
harness-lab의 `commit/message.mjs`·`usage/usage.mjs`·`.githooks/*`·`commit-and-issue.md`를 ClauseLens로 옮긴다. 훅은 **셸 심(`.githooks/commit-msg`·`prepare-commit-msg`) → 로직 `.mjs`(`agents/harness/commit/*.mjs`)** 구조. 작업 브랜치 판정은 [0023] `records.mjs`의 `isWorkBranch`(브랜치명 이슈번호) 재사용. usage는 folder/trace 의존부를 떼고 브랜치 누적만.

### 2. 고려한 대안
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 확장자 없는 ESM 훅(harness-lab 그대로) | 원본과 동일 | 루트에 `type:module` 필요 → 모노레포 툴링 영향 | ❌ |
| 셸 심 → `.mjs` | ESM 명확, 노드 버전 견고, 루트 설정 불변 | 파일 2개 더 | ✅ |
| pnpm 없이 husky 등 | 표준 | 의존성 추가 | ❌ |

### 3. 영향받는 코드 (파일·순서)
1. `agents/harness/commit/message.mjs`(+`.test.mjs`) — 세 섹션 검사·삽입(도메인 무관, 원본 복사).
2. `agents/harness/usage/usage.mjs`(+`.test.mjs`) — transcript 토큰 집계(브랜치 누적·`--commit`·`--transcript`).
3. `agents/harness/commit/{commit-msg,prepare-commit-msg}.mjs` — 훅 로직(ESM).
4. `.githooks/{commit-msg,prepare-commit-msg}` — 셸 심(chmod +x).
5. `agents/harness/lib/records.mjs` — `isWorkBranch` 추가.
6. `package.json`(root) — `prepare`(hooksPath)·`usage` 스크립트.
7. `.github/ISSUE_TEMPLATE/*.yml`·`pull_request_template.md` — 세 섹션.
8. `agents/harness/commit-and-issue.md` + `AGENTS.md` §1.
9. `agents/harness/evals/checks.sh` — 새 테스트 포함.

### 4. 위험과 완화
- R1 훅 활성 후 모든 작업 커밋이 세 섹션 필수 → 워크플로 변화. 완화: 자동 기입([컨텍스트·토큰])·면제(머지/fixup)·`--no-verify` 탈출구.
- R2 transcript 형식 변경 시 집계 깨짐 → "집계 불가"로 표시하고 커밋은 막지 않음(방어).
- R3 이미 설치된 폴더는 `prepare` 미실행 → `pnpm run prepare` 안내(지침서).

### 5. 롤아웃 / 되돌리기
- `git config --unset core.hooksPath`로 즉시 비활성. 파일 삭제로 롤백. checks.sh 테스트 줄 제거로 게이트 무력화.

### 6. 검증
- `node --test`(message·usage 파서) 통과.
- 실제 커밋: 섹션 누락 → 거부 / `[허점]`·`[보완]`만 → `[컨텍스트·토큰]` 자동 기입 후 통과.
- `bash agents/harness/evals/checks.sh` (Expo Doctor 기존 드리프트 제외 PASS).
