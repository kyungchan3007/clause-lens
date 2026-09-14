# 0002 — 의존성 정렬 & CI/리뷰 하드닝

> 오늘(#16·#18) 작업의 과정 기록. SDD/PRD 상시 규칙의 첫 소급 적용.
> **관련 태스크**: #16, #18 · **상태**: shipped (develop 머지 완료)

---

## PRD (왜/무엇)

### 1. 문제
- 완료 게이트(`checks.sh`)의 Expo Doctor가 **패키지 버전 드리프트**로 FAIL → 모든 태스크의 완료 판정을 막는 공용 블로커.
- PR AI 리뷰가 매 push마다 PR 전체를 재리뷰하고, 이전에 해결·기각된 지적을 기억 못 해 **같은 트집을 무한 반복** → 개발 흐름 저해.

### 2. 목표
- G1. 게이트를 초록으로 복구하고, 네이티브 모듈 중복이 재발하지 않도록 강제.
- G2. PR 리뷰가 **변경분만** 보고 **이미 논의된 건 반복하지 않도록** 수렴.

### 3. 비목표
- 서버/기능 코드 변경 없음. 리뷰 프롬프트 품질 튜닝(문구 미세조정)은 별도.

### 4. 제약
- pnpm만 사용. Expo v57 고정. 공용 CI 스크립트(Codex 소유)라 동작 보존.

### Acceptance
- [x] `bash agents/harness/evals/checks.sh` ALL PASS (Typecheck + Expo Doctor 21/21 + lockfile 가드 + native 단일버전)
- [x] 앱·`packages/ui`의 react-native 버전 일치, 중복 0
- [x] 리뷰 스크립트 `node --check` PASS + sha 추출/compare 게이팅 단위검증 PASS

---

## SDD (어떻게)

### 1. 읽은 문서
`architecture.md`, `README.md`(인프라·서버), `checks.sh`, `pnpm-workspace.yaml`, `.github/scripts/pr-ai-review.mjs`, `github-pr-review-workflow.md`.

### 2. 접근
- **#16**: `expo install --fix`로 앱 6개 패키지 정렬 + `packages/ui`의 `react-native`도 함께 0.86.3. 재발 방지로 overrides·게이트 추가.
- **#18**: 리뷰를 compare API 기반 **증분**으로 전환하고, 커밋 메시지·이전 코멘트를 프롬프트에 넣어 **반복 억제**.

### 3. 고려한 대안 · 트레이드오프
| 주제 | 대안 | 결정 | 근거 |
| --- | --- | --- | --- |
| overrides 위치 | 루트 `package.json`의 `pnpm.overrides` | **`pnpm-workspace.yaml`** | pnpm 10+ 정식 위치. **실증**: lockfile에 override 기록됨 + `packages/ui`가 0.86.2 선언해도 resolved 0.86.3(override 승리). 리뷰의 "package.json이어야 함"은 구버전 기준이라 기각. |
| 네이티브 중복 검증 | store 디렉터리 개수 세기 | **`pnpm list -r` resolved 집계** | store엔 아무도 안 쓰는 **orphan** 엔트리가 `store prune` 전까지 남아 개수 세기는 거짓 FAIL. resolved 기반이 정확. |
| lockfile 가드 | glob(`apps/*`,`packages/*`) 나열 | **`find`(node_modules 제외, 전체 깊이)** | glob은 nested yarn.lock 누락. find가 근본적. |
| 리뷰 범위 | 1회만 리뷰 / 전체 재리뷰 | **증분(compare) + 맥락** | 1회는 이후 변경 놓침, 전체는 반복. 증분+맥락이 "새 것만, 반복 없이". |

### 4. 파일·순서
1. `apps/mobile/package.json`·`packages/ui/package.json`·`pnpm-lock.yaml` (버전 정렬)
2. `pnpm-workspace.yaml`(overrides), `.gitignore`, `checks.sh`(lockfile 가드), `check-native-singletons.mjs`(신규)
3. `.github/scripts/pr-ai-review.mjs`(증분+맥락), `github-pr-review-workflow.md`

### 5. 위험 · 완화
- R1: SDK 버전업 시 overrides가 옛 버전 고정 → 드리프트. **완화**: 게이트가 즉시 FAIL로 알림 + guardrails에 "함께 올릴 것" 명시.
- R2: 리뷰 증분 로직이 force-push 히스토리에서 오작동. **완화**: compare status가 `ahead`/`identical`일 때만 증분, 그 외 전체 리뷰 fallback.

### 6. 검증 (결과)
- 게이트 ALL PASS. override 작동을 **의도적 버전 어긋냄 실험**으로 실증(0.86.2 선언→resolved 0.86.3, `pnpm why`상 0.86.2 참조처 0).
- 네이티브 단일버전 게이트: 2버전 주입 시 FAIL / 단일 시 PASS / orphan 오탐 없음 확인.
- 리뷰 스크립트: `node --check` PASS, sha 추출·compare 게이팅 목데이터 단위검증 PASS.
- **미검증(정직)**: 리뷰 증분·맥락의 실제 GitHub 동작은 로컬에서 호출 불가 → 머지 후 다음 PR push에서 관측 필요.
