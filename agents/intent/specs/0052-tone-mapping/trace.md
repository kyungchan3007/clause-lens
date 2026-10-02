# 0052 — 과정 기록 (trace)

## 판단
- **통합 전 role 값을 상상하지 않고 1:1 대조부터 했다.** clausePresentation 로컬 맵과 ui 헬퍼의 role을 직접 비교:
  - fg: 로컬 `TONE_TEXT` {danger:dangerText·warning:warningText·success:successText·neutral:textMuted} ≡ ui `TONE_FG_ROLE` 해당 4키. 동일.
  - accent: 로컬 `TONE_ACCENT` {danger:danger·warning:warning·success:success·neutral:textMuted} ≡ ui `TONE_ACCENT_ROLE` 해당 4키. 동일.
  - bg: 로컬 `TONE_BG` {danger:dangerBg·warning:warningBg·success:successBg·neutral:surfaceAlt} → 신규 `toneBackground`에 그대로. 동일.
  - → 세 축 모두 동일 → 통합 가능으로 판정. (다르면 PRD N1·불변 보장에 따라 통합 금지였음.)
- **info 배경 role은 추측하지 않고 기존 테스트에서 확정.** ui `Tone`은 info를 포함하는데 로컬 맵엔 info가 없었다. `tone.test.ts`의 `BADGE_PAIR`가 info 쌍을 `[primary, tint]`로 이미 고정 → `toneBackground("info")=color("tint")`로 맞춤(toneClasses의 `bg-primary-tint`와도 의미 일치).
- **riskTone 확장은 default 폴백 재사용.** `severityTone`은 null→neutral이었고 `riskTone`의 `switch`도 이미 `default→neutral`. 그래서 시그니처만 `ClauseRiskLevel | null | undefined`로 넓히면 null/undefined가 자연히 neutral로 떨어져 **분기 추가 없이** 동작 동일. 기존 호출부(level만 넘김)는 그대로.
- **Tone 단일 출처는 import type로.** entities가 ui를 런타임 import하면 risk.ts에 문서화된 "ui는 도메인을 import하지 않는다"의 결합 역전이 우려됐으나, `import type`만 쓰면 컴파일 후 완전 소거되어 런타임 결합 0. ui 단일 출처 + 런타임 디커플 유지 둘 다 달성.
- **색 리졸버 확인.** `color()`는 `semantic.light[role]`(ACTIVE=light 고정) 반환. role이 동일하므로 반환 hex 동일. 미래 다크 분기도 role 단위라 자동 보존.

## 막힘 / 되돌림
- 첫 게이트에서 `Unit tests (ui)` FAIL — `tone.test.ts`에 `import { semantic }`를 추가했는데 원본 1행에 이미 존재해 `Identifier 'semantic' has already been declared`. 중복 import 1줄 제거로 해결.
- 그 외 typecheck(ui·mobile·api·worker)·전 유닛 테스트는 1회차부터 통과. 최초 FAIL은 spec 폴더 미작성(Task records)과 위 중복 import 둘뿐.

## 검증 결과
- ui·mobile typecheck EXIT 0. 기존 `DocumentRow`·`risk`·`tone` 테스트 **무수정 통과** = 동작 불변 증거.
- `toneBackground` 단위 테스트 추가(hex 형식 + tone별 배경 role 1:1 고정 5케이스).
- 중복 제거: severity→tone 2곳(severityTone·riskTone) → riskTone 1함수. tone→색 로컬 3맵 → ui 헬퍼 3함수. Tone 타입 선언 2곳 → ui 1곳.
- `bash agents/harness/evals/checks.sh` ALL PASS는 최종 재실행으로 확인.
