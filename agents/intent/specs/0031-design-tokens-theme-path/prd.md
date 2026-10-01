# 0031 — 디자인 토큰 정비 + 테마 경로(vars) + 위험도 tone 도메인 (UI/UX 순서 0a) — PRD

> **이슈:** #98 · **관련 태스크**: #98 (task, TASK-U0a) · **상태**: in-progress · **유형**: 기반 (디자인 시스템 · 토큰/테마)

## 1. 문제
로그인 이후 9개 화면 시안이 확정됐지만(14 페이지), 화면 리디자인(순서 1~5)의 **선행인 순서 0(공통 UI 정비)**이 안 돼 있다. 착수 전 Codex 설계 토론에서 드러난 현황·허점:
- 토큰은 3층(light/dark 정의)이 있으나 **preset이 light 하드코딩**, `borderStrong`·`textInverse` 미노출, `fontWeight`·`lineHeight` 미배선.
- 컴포넌트가 `semantic.light.X`를 **inline으로 직접 참조**(Icon·IconBadge 등) → 테마 전환 지점이 분산. "inline만 제거하면 다크 1~2곳"은 거짓(Icon은 className 미지원, 결과 SVG는 실제 색 문자열 필요).
- 시안 배지색 amber**700**인데 토큰 warning=amber**600**, 작은 배지 글자는 **대비 4.5:1 미달**(접근성).
- 위험도 의미 매핑(`clausePresentation`)이 result 피처에만 있어 documents가 공용 못 함(기능 간 직접 참조 금지 위반 위험).

0a는 **토큰·테마 경로·위험도 도메인**만. 공통 컴포넌트 신규·승격은 0b.

## 2. 목표
- G1. **테마 경로 중앙화(vars)**: NativeWind `vars()`로 semantic 색을 테마 변수로 공급(루트 Provider, light 값). 컴포넌트는 semantic className만으로 색을 받고, 다크는 나중에 **변수 스왑**으로 전환 가능.
- G2. **색 리졸버 단일화**: Icon·SVG·네이티브 색 prop을 단일 `color(role)` 경로로 해석(현재 light). `semantic.light.X` inline 기본색 제거.
- G3. **preset 보강**: `borderStrong`·`textInverse` 노출, `fontWeight`·`lineHeight` 배선.
- G4. **대비 분리**: 배지 텍스트용(진한 700대)과 점/배경용(600/50)을 **별도 semantic 역할**로 분리(WCAG 4.5:1). severity를 접근성 라벨에 포함할 수 있는 토대.
- G5. **위험도 tone 도메인 레이어**: 앱 도메인(`entities/clause` 등)에 `riskTone(level): Tone`(**hex 아님**) + 라벨·아이콘. result가 사용, documents는 0b에서. `packages/ui`로 이동하지 않음.

## 3. 목표가 아닌 것 (Non-goals)
- N1. **다크모드 출시·시스템 테마**(`userInterfaceStyle`·expo-system-ui·router/statusbar/modal 다크) — 구조만, 출시 보류.
- N2. **공통 컴포넌트 신규·승격**(ListRow·Badge tone·EmptyState·IconButton 등)·checks.sh ui 테스트 배선 — **0b**.
- N3. **화면 리디자인**(①~⑨ 재배치) — 순서 1~5.
- N4. 썸네일(계약에 이미지 URL 없음 → 이미지 재열람 후속).
- N5. spacing 토큰 체계 신설 — 보류(단위 기준 rem=14만 확정).

## 4. 제약 (Constraints)
- **NativeWind rem=14**(metro inlineRem 미지정) — 치수 가정의 기준. (0a는 치수 컴포넌트 변경 없음; 0b에서 min-height 정책.)
- `ui → tokens` 의존 방향 유지. `packages/ui`는 백엔드 위험 계약을 모른다.
- 동작 회귀 금지(result 위험도 표시 기존 유지). base=develop(#96 머지 포함).
- 완료 전 `bash agents/harness/evals/checks.sh` PASS.

## Acceptance
- [x] preset이 `border.strong`·`foreground.inverse`를 노출하고 `fontWeight`·`lineHeight`가 tailwind theme에 배선된다. (tailwind-preset.js)
- [x] semantic 색이 NativeWind `vars()` 테마 변수로 루트(`ThemeProvider`)에서 공급되고, 컴포넌트는 semantic className만으로 색을 받는다(light). 다크는 `cssVars("dark")` 스왑 1곳 구조. (**시뮬레이터 실측: 촬영하기=Cobalt#2563EB·배경·텍스트·배지 전부 `var(--cl-*)`로 정상 렌더**)
- [x] Icon·SVG·네이티브 색 prop이 단일 `color(role)` 경로로 해석되고, `packages/ui`·result의 inline `semantic.light.X` 기본색이 제거된다(grep 0건 — 주석 제외). (app 피처 capture·profile·entitlement inline은 0b 승격 시 정리)
- [x] 배지 텍스트 대비용 역할 `dangerText`·`warningText`·`successText`(700대)가 토큰에 추가되어 텍스트와 점/배경(600/50)이 분리된다. (단위: warningText≠warning)
- [x] `riskTone(level)`이 tone을 반환하는 앱 도메인 레이어(`entities/clause`)가 생기고 result가 이를 사용(hex 미반환, 기능 간 직접 참조 없음). (clausePresentation = entities + color() 합성)
- [x] 단위 테스트(riskTone·color 리졸버·cssVars 완전성) + 게이트 `checks.sh` PASS. (mobile 114 PASS · 게이트 ALL PASS)
