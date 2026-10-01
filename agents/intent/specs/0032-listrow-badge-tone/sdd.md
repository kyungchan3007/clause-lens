# 0032 — ListRow·Badge(tone)·StatusDot + 승격 + UI 테스트 게이트 (0b-1) — SDD

> **관련 PRD**: prd.md · **이슈:** #100

## 1. 접근 (Approach)

### 1-1. 테마 tone 매핑 (packages/ui 내부, entities 비의존)
- `packages/ui/src/tone.ts`(신규): `Tone = "neutral"|"danger"|"warning"|"success"|"info"`.
  - `toneClasses(tone)` → `{ container, text }` className(정적색=0a vars 경로): danger/warning/success=`bg-*-bg`/`text-*-text`, neutral=`bg-surface-alt`/`text-foreground-muted`, info=`bg-primary-tint`/`text-primary`.
  - `toneForeground(tone)`·`toneAccent(tone)` → `color(role)` hex(Icon·StatusDot 색 prop용): fg=danger/warning/success→`*Text`·neutral→`textMuted`·info→`primary`; accent=danger/warning/success(600)·neutral→`textMuted`·info→`primary`.
  - `riskTone`(entities)과 **문자열 호환**(같은 Tone 이름) — ui는 entities를 import하지 않고, 소비자(result)가 riskTone→tone을 넘긴다.

### 1-2. 컴포넌트 (packages/ui)
- **Badge**(재작성): props `{ label, tone?, icon?, className? }`. `color`/`backgroundColor` **제거**. container=`toneClasses(tone).container`+pill, 텍스트=`toneClasses().text`, icon=`<Icon color={toneForeground(tone)} />`. 기본 tone=neutral.
- **StatusDot**(신규): `{ tone, size? }` → `<View style={{backgroundColor: toneAccent(tone), width,height,borderRadius}}>`. 접근성 없음(장식) — 의미는 인접 텍스트.
- **ListRow**(신규): `{ title, supporting?, leading?, trailing?, onPress?, disabled?, variant?, accessibilityLabel?, accessibilityHint? }`.
  - `onPress` 있으면 `Pressable`(role=button, state disabled, active:opacity) 없으면 `View`.
  - 레이아웃: `flex-row items-center gap-3` + leading / 중앙(`flex-1 min-w-0`: title Text + supporting) / trailing. **trailing은 바깥 Pressable 안**(행 전체 터치).
  - `variant`: `card`=`rounded-2xl border border-border bg-surface p-3` · `flat`=`min-h-[56px] border-b border-border bg-surface px-4`.
  - `supporting`: string→`<Text className="mt-0.5 text-xs text-foreground-muted">`, node→그대로.
  - a11y: label 없으면 title. disabled→state+외형.
- index.ts export: ListRow·StatusDot·Tone·toneClasses 등.

### 1-3. 승격 (apps/mobile)
- **DocumentRow**: ListRow(variant=card)로 재작성. leading=문서 아이콘 박스, title=label, supporting=메타행(완료시각·StatusDot+위험건수)+partial 줄, trailing=보관 Badge(tone=urgent?danger:warning)+chevron. 위험 점=StatusDot(riskSummary top→tone). inline `semantic.light` 제거(color()·className). **a11y 라벨에 partial·analyzed/total 포함**.
- **MenuRow**(profile): ProfileScreen 내 인라인 MenuRow를 ListRow(variant=flat)로. 아이콘 leading·title·chevron trailing·행 press.
- **ClauseCard**: Badge를 `tone`으로(risk.tone). clausePresentation에 `tone` 추가.
- RecentAnalysisSection·RecentListScreen: DocumentRow 사용부는 유지, 자체 inline `semantic.light`(아이콘 색 등) → color().

### 1-4. UI 테스트 게이트
- `apps/mobile/jest.ui.config.js`(신규): mobile jest(jest-expo preset) 재사용, `rootDir="../../packages/ui"`, `roots=["<rootDir>/src"]`, `setupFiles=[]`(mobile env 불필요), transformIgnorePatterns 상속.
- `checks.sh`: `run "Unit tests (ui)" pnpm --filter @clause-lens/mobile exec jest --config jest.ui.config.js` + `run "Typecheck (ui)" pnpm --filter @clause-lens/ui exec tsc --noEmit`(ui tsconfig·typescript 보강).
- 테스트: `packages/ui/src/*.test.tsx` — Badge tone 매핑·대비(휘도비 ≥4.5:1, 각 tone fg/bg) · ListRow(onPress 유무 모드·a11y 이름·disabled) · StatusDot(tone 색). react-test-renderer 또는 @testing-library/react-native(이미 jest-expo 포함 여부 확인, 없으면 renderer).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| **ListRow variant(card/flat)** | 배치·press 공통 + 표면만 분기 | variant 관리 | ✅(Codex) |
| ListRow 단일 표면 강제 | 단순 | DocumentRow 카드/MenuRow 평면 섞임·리디자인 혼입 | ❌ |
| trailing press 제외(원안) | 독립 액션 쉬움 | **배지·chevron 탭 시 문서 안 열림=회귀** | ❌(철회) |
| Badge color/bg 유지(deprecated) | 점진 전환 | 잘못된 조합·접근성 미보증, 소비자 1개뿐 | ❌ → 같은 변경에서 제거 |
| ui가 riskTone import | 매핑 1곳 | ui가 백엔드/도메인 계약 앎(경계 위반) | ❌ → 소비자가 tone 주입 |
| FreeQuotaRow→Badge | 간단 | 로딩/재시도/stale/0회 분기 손실 | ❌(0b-2에서도 금지) |
| ui에 jest-expo 복제 | 독립 | 설정·버전 복제 비용 | ❌ → mobile config 재사용 |
| 대비=팔레트 700 신뢰 | 쉬움 | 700≠대비 보증 | ❌ → 휘도비 단위 검사 |

## 3. 영향받는 코드 (Touched Surface)
- `packages/ui/src/`: tone.ts·list-row.tsx·status-dot.tsx(신규), badge.tsx(tone 재작성), index.ts. `*.test.tsx`(신규). tsconfig·package(typescript devDep).
- `apps/mobile/jest.ui.config.js`(신규) · `agents/harness/evals/checks.sh`(ui 테스트·typecheck 항목).
- `apps/mobile/src/features/documents/ui/DocumentRow.tsx`·RecentAnalysisSection.tsx·RecentListScreen.tsx · `features/profile/ui/ProfileScreen.tsx`(MenuRow) · `features/result/ui/ClauseCard.tsx`·lib/clausePresentation.ts(tone 추가).

## 4. 검증 (Verification)
- **단위(ui)**: Badge tone→className/foreground 매핑·대비 휘도비 ≥4.5:1(danger/warning/success/neutral/info) · ListRow onPress 유무(Pressable vs View)·disabled·a11y 이름·trailing이 press 영역 내 · StatusDot tone 색.
- **단위(mobile)**: DocumentRow a11y 라벨에 partial·analyzed/total 포함 · 승격 후 콜백(onPress→documentId)·상태 표시 회귀 없음(기존 테스트 유지) · clausePresentation tone.
- **타입체크**: mobile + **ui(tsc --noEmit)** — 미사용 신규 파일 포함.
- **시뮬레이터 실측**: 홈/최근목록/프로필/결과에서 ① 배지·chevron 탭해도 행 액션(문서 열림) ② 색(tone·배경·점) 정상 ③ VoiceOver로 partial 읽힘(가능 범위) ④ 터치 영역.
- **게이트**: `checks.sh` ALL PASS(+Unit tests (ui)·Typecheck (ui)).

## 5. 리스크 / 롤백
- **승격 회귀**(터치 영역·a11y·상태) → 소비자별 수용조건 단위 + 실측. 문제 시 해당 소비자만 기존 구현 유지(ListRow는 추가일 뿐).
- **jest.ui 설정**이 jest-expo transform과 안 맞으면 → testMatch/transformIgnore 조정, 최후 ui 로컬 jest.
- Badge color/bg 제거로 **외부 소비자 깨짐** → ui private·소비자=ClauseCard뿐(grep 확인), 같은 변경에서 전환.
- 대비 미달 tone 발견 시 → `*Text` 역할 조정(0a 토큰)로 교정.
