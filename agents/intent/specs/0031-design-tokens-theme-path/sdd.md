# 0031 — 디자인 토큰 정비 + 테마 경로(vars) + 위험도 tone 도메인 (0a) — SDD

> **관련 PRD**: prd.md · **이슈:** #98

## 1. 접근 (Approach)

### 1-1. 토큰 (`packages/tokens`)
- **semantic.js**: light·dark 각각에 **배지 텍스트 대비용 역할** 추가 — `dangerText`(red700)·`warningText`(amber700)·`successText`(green700). 기존 danger/warning/success(600)는 점·강조·테두리용, `*Bg`(50)은 배경용으로 유지. (시안 보관 배지 amber700 = `warningText`.)
- **theme-vars.js**(신규): `ROLES`(semantic 역할 이름 배열) + `cssVars(themeName)` → `{"--cl-primary": hex, …}`(vars() 공급용). light/dark 모두 생성 가능(지금은 light만 적용).
- **color.js**(신규): `color(role)` → 현재 테마(light) hex 반환. **색 prop(Icon·SVG·네이티브)의 단일 해석 지점**. 다크는 후속에서 이 리졸버가 활성 테마를 읽게 확장(구조만 명시).
- **tailwind-preset.js**: semantic 색 별칭을 **`var(--cl-*)` 참조**로 교체(primitive 팔레트는 hex 유지). 누락 노출 보강 — `border.strong`·`foreground.inverse`·`danger.text`/`warning.text`/`success.text`. `fontWeight`·`lineHeight`를 `theme.extend`에 배선.
- index.js/index.d.ts에 `color`·`cssVars`·`ROLES`·신규 semantic 역할 추가.

### 1-2. 테마 경로 (`apps/mobile/src/shared/theme/`, 신규)
- **ThemeProvider**: `<View style={vars(cssVars("light"))} className="flex-1">{children}</View>`(nativewind `vars`). 루트 `app/_layout.tsx`의 최상위(GestureHandlerRootView 안)에서 1회. → 모든 하위가 `var(--cl-*)` 해석 → semantic className 그대로 작동, 값은 변수에서.
- **useThemeColor()**: 활성 테마의 color map(light) 반환(색 prop용). 지금 light 고정, 다크는 `useColorScheme` 연결로 확장.
- **다크 보류**: dark 값·`userInterfaceStyle`·expo-system-ui·시스템 UI는 후속. 구조(vars 스왑 지점 1곳)만 확보.

### 1-3. 위험도 tone 도메인 (`apps/mobile/src/entities/clause/`, 신규 레이어)
- `lib/risk.ts`: `type Tone = "danger"|"warning"|"success"|"neutral"`; `riskTone(level): Tone`(high→danger, medium→warning, low→success); `riskLabel(level)`·`riskIcon(level)`. **hex 미반환** — 색은 소비자가 tone→`color()`/className으로 해석.
- result의 `features/result/lib/clausePresentation.ts`의 위험도 매핑을 여기로 이관. result는 `entities/clause`를 사용(조항 종류 라벨 `clauseTypeLabel`도 함께 이동 검토). documents는 0b에서 사용.
- FSD: features → entities → shared → tokens 방향(기능 간 직접 참조 해소).

### 1-4. inline 제거 범위 (0a)
- `packages/ui`(icon·icon-badge)의 inline `semantic.light.X` 기본색 → `color(role)`로 교체.
- result가 쓰는 위험도 색은 tone 경유.
- **app 피처(capture·profile·entitlement)의 inline `semantic.light`는 0b에서** 각 컴포넌트 승격 시 정리(이번 scope 명시적 제외 — 회귀 방지 위해 묶어서).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| global.css `:root` 변수 + `dark:` variant | NativeWind 표준·web 친화 | 런타임 서브트리 테마 어려움·light만인 지금 과함 | ❌(폴백 후보) |
| **vars() 루트 공급 + config `var(--cl-*)`** | semantic className 유지·다크=변수 스왑 1곳·네이티브 서브트리 | 전역 색 배선 변경(실측 필수) | ✅(사용자 결정) |
| light hex 고정 + `color()`만 중앙화 | 가벼움 | "다크 1~2곳"은 거짓(Codex)·variable화 안 하면 전환 부채 | ❌ |
| riskTone을 `packages/ui`에 | 한 곳 | ui가 백엔드 위험 계약 앎(경계 위반) | ❌ → entities |
| riskTone이 hex 반환 | 단순 | 테마·SVG 재해석 불가 | ❌ → tone 반환 |

## 3. 영향받는 코드 (Touched Surface)
- `packages/tokens/`: semantic.js(+텍스트 역할)·theme-vars.js(신규)·color.js(신규)·tailwind-preset.js(var 참조·누락 노출·weight/lineHeight)·index.js·index.d.ts.
- `apps/mobile/src/shared/theme/`(신규): ThemeProvider·useThemeColor·index + 테스트.
- `apps/mobile/app/_layout.tsx`: ThemeProvider 마운트.
- `apps/mobile/src/entities/clause/`(신규): lib/risk.ts(+테스트) · index.
- `apps/mobile/src/features/result/`: clausePresentation → entities/clause 사용(이관).
- `packages/ui/src/icon.tsx`·`icon-badge.tsx`: inline → `color()`.
- 단위 테스트(riskTone·color·cssVars 완전성).

## 4. 검증 (Verification)
- **단위**: `riskTone`(3단계+경계)·`color(role)`(모든 역할 반환)·`cssVars`(ROLES 전부 포함, 누락 0)·preset 스냅(선택).
- **타입체크**: mobile·(ui·tokens 소비) — `tsc --noEmit`.
- **시뮬레이터 실측(필수)**: vars() 배선이라 **전역 색이 깨지지 않는지 눈으로 확인** — Metro 재시작(캐시 클리어) 후 홈·프로필·결과 화면 색(배경·텍스트·배지·primary 버튼)이 기존과 동일하게 렌더. (단위로는 NativeWind 스타일 생성·var 해석 검증 불가 — Codex 지적.)
- **grep**: `packages/ui`·result에서 inline `semantic.light.` 0건.
- **게이트**: `bash agents/harness/evals/checks.sh` PASS.

## 5. 리스크 / 롤백
- **최대 리스크**: config 색을 `var(--cl-*)`로 바꿨는데 루트 vars() 미적용/미해석 → 전역 색 소실. 완화: ThemeProvider를 최상위에 배치 + **시뮬레이터 실측 필수** + 실패 시 폴백(global.css `:root` 변수 방식). 롤백: preset을 hex로 되돌리면 즉시 복구(변경이 preset·Provider에 국한).
- NativeWind `vars`/`var()` 동작이 4.2.6에서 기대와 다르면 폴백안으로 전환(SDD §2).
- riskTone 이관으로 result 표시 회귀 가능 → 단위 + 결과 화면 실측.
