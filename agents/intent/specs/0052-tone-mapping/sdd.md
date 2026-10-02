# SDD — 위험도→tone·tone→색 매핑 단일화

> **관련 PRD:** 0052-tone-mapping/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"매핑은 한 곳에서만 선언" 원칙의 재배선. 두 축을 각각 단일 출처로 모은다 — **severity→tone**은 도메인(entities/`riskTone`), **tone→색(role)**은 ui(`toneForeground/Accent/Background`). 통합 전에 각 맵의 **role 값을 1:1 대조**해 동일함을 확인하고, 다르면 통합하지 않는다.

- **severity→tone (G1)** — DocumentRow의 로컬 `severityTone(top)`는 `riskTone`과 완전 동일한 분기(high→danger·medium→warning·low→success·그 외→neutral). 차이는 입력 타입뿐: `severityTone`은 `RiskSeverity`(= `"high"|"medium"|"low"|null`)를 받고, `riskTone`은 `ClauseRiskLevel`(널 불가)만 받음.
  - → `riskTone` 시그니처를 `ClauseRiskLevel | null | undefined`로 소폭 확장. `switch`는 이미 `default → "neutral"`이라 null/undefined가 자연히 neutral로 폴백. 기존 호출부(level만 넘김) 동작·반환 불변.
  - DocumentRow는 `severityTone` 삭제 후 `riskTone(top)` 호출. `RiskSeverity`의 비-null 값은 `ClauseRiskLevel`과 동일 집합이라 타입 안전.
- **tone→색 (G2)** — ui에 `toneBackground(tone)` 추가(기존 fg·accent와 같은 `const ROLE 맵 + color(ROLE[tone])` 패턴). role 값은 clausePresentation 로컬 `TONE_BG`와 1:1 동일(danger→dangerBg·warning→warningBg·success→successBg·neutral→surfaceAlt), 5번째 `info→tint`는 ui `Tone`이 info를 포함하므로 보강(tone.test.ts의 `BADGE_PAIR` info 쌍 `[primary, tint]`과 일치).
  - clausePresentation은 로컬 3맵(`TONE_TEXT/TONE_ACCENT/TONE_BG`)과 `color` import 제거 → `toneForeground/toneAccent/toneBackground(tone)` 소비. role이 동일하므로 반환 hex 완전 불변.
- **Tone 단일 출처 (G3)** — entities/`risk.ts`의 로컬 `type Tone` 선언을 제거하고 `import type { Tone } from "@clause-lens/ui"` + `export type { Tone }`로 재노출. `import type`라 **런타임 결합 0**(ui는 여전히 도메인 미참조, 도메인은 ui 런타임 미참조). `riskTone` 반환 타입이 5값으로 넓어지나 실제 반환은 4값뿐이고 소비자(Badge·StatusDot)는 5값 superset을 받으므로 안전.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. severity→tone=도메인, tone→색=ui로 각각 단일화 + Tone은 ui `import type` 재노출 | 중복 제거, 런타임 결합 0, 동작 불변, 테스트 쉬움 | 도메인 Tone이 info(미사용)까지 넓어짐(무해) | ✅ |
| B. `Tone`을 tokens(최하위)로 끌어올려 ui·entities가 공통 참조 | 레이어상 가장 깔끔 | tokens·ui·entities 3패키지 동시 변경 → 이 이슈 범위(동작 불변 refactor) 초과 | ❌(후속) |
| C. DocumentRow에 `riskTone(top ?? "none")` 식 호출부 보정 | riskTone 시그니처 불변 | 호출부마다 널 처리 복붙(또 다른 중복), 의도 불명확 | ❌ |
| D. tone→색 매핑 role이 달랐다면 통합 | — | 라이트/다크 색이 바뀜 → 동작 불변 위반 | ❌(대조 결과 동일이라 무관) |

## 3. 검증 (Verification)
- tone→role 1:1 대조: fg·accent·bg 3축 × danger/warning/success/neutral 4값이 로컬 맵과 ui 헬퍼에서 **완전 동일**함을 코드로 확인(통합 전제 충족).
- `color()`는 현재 light 고정 + role 동일 → 라이트/다크 모두 색 불변. 미래 다크 분기도 role 단위라 자동 보존.
- `toneBackground` 단위 테스트 추가(tone별 배경 role 색 고정). 기존 `DocumentRow`·`risk`·`tone` 테스트 무수정 통과.
- 게이트: contracts/db 빌드 → ui/mobile typecheck → ui/mobile 유닛 → `checks.sh` ALL PASS.
