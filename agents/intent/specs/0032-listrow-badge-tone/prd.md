# 0032 — ListRow·Badge(tone)·StatusDot 신설 + DocumentRow/MenuRow 승격 + UI 테스트 게이트 (순서 0b-1) — PRD

> **이슈:** #100 · **관련 태스크**: #100 (task, TASK-U0b1) · **상태**: in-progress · **유형**: 기반 (디자인 시스템 · 공통 컴포넌트)

## 1. 문제
화면 리디자인(순서 1~5)이 조립할 공통 컴포넌트가 없다. 리스트/배지 패턴이 피처에 인라인·중복(DocumentRow·MenuRow·ClauseCard Badge)이고, `packages/ui`에는 리스트 행이 없으며 Badge는 색을 수동 주입한다. 0a(#98)로 토큰 vars 테마·`color()`·`entities/clause`(riskTone→tone)가 준비됐으니, 그 위에 리스트/배지 계열을 신설·승격한다. 착수 전 Codex 설계 토론 → 수렴안. 0b-2(Button 등)는 후속.

## 2. 목표
- G1. **UI 테스트 게이트 배선**: `packages/ui/src`에 테스트를 두되 mobile jest-expo 설정을 재사용(복제 금지), `checks.sh`에 별도 항목(passWithNoTests 금지) + ui 파일 typecheck.
- G2. **ListRow** 신설(최소 슬롯): `title`(string)·`supporting`(string→기본 Text / node→호출측)·`leading`·`trailing`·`onPress`(유무로 Pressable/View)·`disabled`·표면 `variant`(card/flat). **trailing 포함 행 전체 press** 보존(독립 버튼 금지). a11y label/state.
- G3. **Badge tone**: `tone`(neutral/danger/warning/success/info)→foreground/background/icon 정적 역할 매핑. `color`/`backgroundColor` prop 제거(ClauseCard 전환). 대비 휘도비 ≥4.5:1 단위 검사. ui는 `entities/clause` import 금지.
- G4. **StatusDot(tone)** 신설(점 색=accent, 의미는 인접 텍스트).
- G5. **승격(동작 보존)**: DocumentRow·profile MenuRow → ListRow 조립. **전체 행 터치·문서ID·라벨 유지**. DocumentRow a11y 라벨에 **partial·분석 페이지 수 포함**(버그 보완).
- G6. **inline 정리**: 전환 범위(DocumentRow·RecentAnalysisSection·RecentListScreen·ProfileScreen MenuRow)의 inline `semantic.light` 제거.

## 3. 목표가 아닌 것 (Non-goals)
- N1. Button·IconButton·SectionHeader variant·표시용 EmptyState·capture/entitlement inline = **0b-2(#101)**.
- N2. BrandHeader·Notice·card shadow = **순서1(홈)**에서 실제 소비 확인 후.
- N3. 다크모드·썸네일·Chip·화면 리디자인·선택/삭제/스와이프(ListRow 첫 API 제외).
- N4. FreeQuotaRow를 Badge로 교체(0b-2에서도 금지 — 상태 분기 유지).

## 4. 제약 (Constraints)
- `ui → tokens` 의존만. `packages/ui`는 백엔드 위험 계약·앱 도메인(entities) 모름 — tone 문자열만 받음.
- 정적색=className(0a vars 경로) / 색 prop(Icon)=`color()`. 동작·접근성 회귀 금지.
- base=develop(0a 포함). 완료 전 `checks.sh` PASS(+신규 ui 테스트 항목).

## Acceptance
- [x] UI 테스트가 mobile jest-expo로 수집·실행되고 `checks.sh`에 별도 항목(`Unit tests (ui)`)으로 배선 + ui 파일 typecheck(`Typecheck (ui)`, 테스트 제외·미사용 컴포넌트까지). (`jest.ui.config.js`·lucide 목)
- [x] `ListRow` 신설(슬롯·onPress 유무 Pressable/View·disabled·표면 variant card/flat·제목 타이포 variant), **trailing 포함 행 전체 press** 보존, 단위 테스트(모드·a11y 이름·supporting string/node).
- [x] `Badge`가 `tone`으로 전환되고 `color`/`backgroundColor` 제거, ClauseCard 전환. tone→역할 정적 매핑 + **대비 ≥4.5:1 단위 검사(5 tone WCAG)**. ui가 entities import 안 함(tone 문자열만).
- [x] `StatusDot(tone)` 신설(accent 색·장식).
- [x] `DocumentRow`·`MenuRow`가 ListRow로 조립되고 동작·표시 회귀 없음(전체 행 터치·ID·라벨). DocumentRow a11y에 partial·분석 페이지 수 포함. (**시뮬레이터 실측: 홈 최근 카드 행·프로필 1:1 문의 평면 행·FreeQuotaRow 보존**)
- [x] 전환 범위 파일 inline `semantic.light` 0건(grep).
- [x] 단위(ui 13·mobile 117) + 시뮬레이터 실측(홈·프로필 터치·색) + 게이트 ALL PASS.
