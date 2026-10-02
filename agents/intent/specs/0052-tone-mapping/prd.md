# PRD — 위험도→tone·tone→색 매핑 단일화

> **이슈:** #145 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
"위험도(severity) → tone" 과 "tone → 색(role)" 매핑이 **여러 파일에 복붙**되어 drift 위험이 있다.

- `apps/mobile/src/features/documents/ui/DocumentRow.tsx`의 로컬 `severityTone()`가 `entities/clause`의 `riskTone()`과 **같은 severity→tone 분기를 중복**(high→danger·medium→warning·low→success·없음→neutral).
- `apps/mobile/src/features/result/lib/clausePresentation.ts`의 로컬 `TONE_TEXT/TONE_ACCENT/TONE_BG`가 `packages/ui/src/tone.ts`의 `toneForeground/toneAccent`와 **같은 tone→role 매핑을 복붙**(배경은 ui에 헬퍼 자체가 없어 로컬에만 존재).
- `Tone` 타입이 `entities/clause`(4값)와 `packages/ui`(5값, `info` 포함) **두 곳에 선언**.

## 2. 목표 (Goals)
- G1. DocumentRow의 `severityTone` 제거 → `riskTone` 재사용(null/undefined 허용되게 `riskTone` 시그니처 소폭 확장, 기존 호출부 동작 불변).
- G2. `packages/ui/src/tone.ts`에 `toneBackground()` 추가(기존 `toneForeground`·`toneAccent`와 동일 패턴). clausePresentation의 로컬 `TONE_TEXT/TONE_ACCENT/TONE_BG`를 ui 헬퍼(fg·accent·bg) 소비로 교체.
- G3. `Tone` 타입 중복을 ui 단일 출처로 정리 — 도메인(entities)은 `type`만 재노출.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 외부 동작 변경 — DocumentRow·result 렌더 결과(색·tone) **완전 불변**(라이트/다크 둘 다). tone→role 값이 다르면 통합 금지.
- N2. `color()` 리졸버·semantic 토큰 값 변경.
- N3. 런타임 레이어 결합 추가 — ui는 여전히 도메인을 import하지 않고, 도메인의 ui 참조는 `import type`(런타임 0).

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 문서 목록 행의 위험 상태 점 색, 결과 화면 조항 배지·하이라이트 색 모두 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(ui·mobile 타입·유닛 테스트 포함).
- 기존 `DocumentRow`·`risk` 테스트가 **무수정 통과**(동작 불변의 증거).
- severity→tone 중복 2곳 → `riskTone` 1함수. tone→색 매핑 로컬 3맵 → ui 헬퍼 3함수.

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. 장기적으로 `Tone`을 tokens(최하위 레이어)가 소유하면 ui·entities 양쪽이 깔끔히 참조 가능. 이번엔 ui 단일 출처로 충분(후속 검토).

### Acceptance
- [x] DocumentRow의 `severityTone` 제거, `riskTone(top)` 재사용. `riskTone`이 `ClauseRiskLevel | null | undefined` 허용(기존 호출부 동작 불변).
- [x] `packages/ui/src/tone.ts`에 `toneBackground()` 추가(role: neutral→surfaceAlt·danger→dangerBg·warning→warningBg·success→successBg·info→tint), `packages/ui` index에서 export.
- [x] clausePresentation 로컬 `TONE_TEXT/TONE_ACCENT/TONE_BG` 제거 → `toneForeground/toneAccent/toneBackground` 소비(role 값 1:1 동일 확인).
- [x] `Tone` 타입 ui 단일 출처화 — entities가 `import type { Tone } from "@clause-lens/ui"` 재노출.
- [x] `toneBackground` 단위 테스트 추가(tone별 배경 role 색 1:1 고정).
- [x] `bash agents/harness/evals/checks.sh` ALL PASS, 기존 테스트 무수정 통과.
