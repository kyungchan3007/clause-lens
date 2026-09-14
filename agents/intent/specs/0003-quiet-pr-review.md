# 0003 — PR 리뷰 노이즈 감소 (docs-only 스킵 + P1-only)

> **관련 태스크**: #23 · **상태**: draft
> SDD/PRD 상시 규칙에 따른 spec (첫 정식 적용 사례).

---

## PRD (왜/무엇)

### 1. 문제
PR AI 리뷰가 코드 버그가 없는 **문서 PR에도** "정책인데 CI 강제 안 됨" 류의 P2 메타 지적을 다수 생성. findings 수가 많아 개발 흐름을 저해하고 사용자가 피로를 호소.

### 2. 목표
- G1. 문서 전용 PR에는 AI 코드 리뷰를 하지 않는다.
- G2. 인라인 코멘트는 **P1(실제 버그·회귀·보안·데이터 손실)** 만 남긴다.

### 3. 비목표
- 리뷰 프롬프트의 전면 재작성. `synchronize` 트리거 제거(증분 리뷰가 이미 처리).

### 4. 제약
- Codex 소유 CI 스크립트 — 기존 증분·맥락 동작(#18) 보존.

### Acceptance
- [x] 모든 변경이 `.md/.mdx`인 PR은 OpenAI 호출 없이 마커만 남기고 스킵
- [x] severity가 P1이 아닌 finding은 인라인으로 남지 않음(요약에 개수만)
- [x] `node --check` PASS + docs-only 판정 단위검증 PASS

---

## SDD (어떻게)

### 1. 읽은 문서
`.github/scripts/pr-ai-review.mjs`(#18 증분판), `github-pr-review-workflow.md`.

### 2. 접근
`main()`에서 PR 전체 파일을 받은 직후 **docs-only 판정 → 스킵**. finding 매핑 루프에서 **severity !== "P1"이면 드롭**. 프롬프트에 "P1만 집중, 메타/저확신 지적 금지" 지시 추가(생성 단계에서 감축).

### 3. 고려한 대안 · 트레이드오프
| 주제 | 대안 | 결정 | 근거 |
| --- | --- | --- | --- |
| 노이즈 원인 | `synchronize` 제거(리뷰 1회) | **유지 + docs-only/P1-only** | 진단 결과 반복은 트리거가 아니라 **findings 과다**였음(#21은 1회 리뷰에 P1 1+P2 3). 트리거는 이미 증분으로 수렴. |
| docs 판정 | `agents/**` 경로 기준 | **`.md/.mdx` 확장자** | `agents/harness/evals/*.mjs`·`checks.sh`는 코드라 경로 기준은 오탐. 확장자가 안전·단순. |
| 심각도 필터 | P1+P2 | **P1만 인라인** | 답답함의 원인이 정확히 P2 메타 지적. P2/P3는 요약 개수로만. |

### 4. 파일·순서
1. `.github/scripts/pr-ai-review.mjs` — docs-only 스킵, P1-only 필터, 프롬프트 지시
2. `agents/harness/github-pr-review-workflow.md` — 동작 반영

### 5. 위험 · 완화
- R1: docs-only 판정이 코드 파일을 놓쳐 리뷰를 부당 스킵. **완화**: 확장자 화이트리스트(.md/.mdx만 docs), 그 외 전부 코드 취급 → 단위검증으로 확인.
- R2: 진짜 P2 이슈를 놓침. **완화**: 요약에 P2/P3 개수 표기(완전 은폐 아님). 필요 시 임계값 조정 가능.

### 6. 검증 (결과)
- `node --check` PASS.
- docs-only 판정 6케이스(모두 md / md+mjs / md+sh / mdx / removed-only / 빈 변경) 단위검증 ALL PASS.
- **미검증(정직)**: 실제 GitHub 리뷰 스킵·P1-only 동작은 로컬 호출 불가 → 머지 후 다음 PR에서 관측.
