# 0034 — Button·IconButton·SectionHeader·EmptyState + semantic.light 정리 (0b-2) — SDD

> **관련 PRD**: prd.md · **이슈:** #101

## 1. 접근 (Approach)

### 1-1. Button 재작성 (packages/ui/src/button.tsx)
- props: `{ label, variant?('primary'|'secondary'|'ghost'), size?('md'|'lg'), fullWidth?, disabled?, busy?, icon?(IconName), onPress?, onPressIn?, onPressOut?, accessibilityLabel?, accessibilityHint?, testID? }`. **className·style·무제한 spread 없음**(허용 목록만 명시 전달).
- 상태색 **내부 1회 매핑**: `variant×(normal|disabled)` → `{ container, label(class), fg(color role) }`. Text=class, Icon·ActivityIndicator=`color(fg)`.
- 치수: `md=min-h-[48px]`·`lg=min-h-[52px]` + 세로 padding(px-4). `fullWidth`면 `w-full`(기본은 현행 유지 — Pressable은 내용폭/부모 stretch에 맡김; 기존 caller가 부모 stretch/행 배치이므로 기본 미지정). label `numberOfLines` 미설정(줄바꿈 허용).
- `busy`: `disabled || busy`로 입력 차단, `accessibilityState={{disabled: disabled||busy, busy: !!busy}}`, 선행 슬롯에 `ActivityIndicator`(label 유지). disabled 외형(opacity) — busy는 스피너로 구분(스피너 흐리게 안 함).
- pressed: Pressable `pressed`로 pressed 배경(variant별), disabled/busy면 pressed 외형 없음. onPressIn/out 전달.

### 1-2. IconButton (신설 packages/ui/src/icon-button.tsx)
- props: `{ icon(IconName), onPress, accessibilityLabel(필수), size?(number, 아이콘 크기), variant?('plain'|'tinted'), disabled?, testID? }`.
- 컨테이너 `minWidth:48, minHeight:48, items/justify center`(터치영역 하한, 아이콘 크기와 독립). tinted=`bg-primary-tint` 원형.
- 아이콘 색=`color('text')`(plain)/`color('primary')`(tinted). Icon 이름은 레지스트리 union(아래).

### 1-3. 아이콘 레지스트리 (packages/ui/src/icon.tsx 보강)
- `IconName` union + 사용 집합 매핑(명시). 잘못된 이름: dev에서 throw(또는 명확 경고)+fallback 아이콘 → **빈 버튼 방지**. 기존 `name: string` Icon은 하위호환 유지(점진), IconButton/Button은 `IconName`만.

### 1-4. SectionHeader (packages/ui/src/section-header.tsx 보강)
- props: `{ label, variant?('label'|'title'), action?: { label, onPress }, className? }`.
- `label` variant=현행(muted xs·`px-4 pb-2 pt-6`). `title` variant=`text-base font-bold`, **여백 최소화**(제목+action을 flex-row justify-between, 외부 여백은 호출측 소유 — 이중 여백 방지). action=형제 Pressable(button role·터치영역).

### 1-5. EmptyState (신설 packages/ui/src/empty-state.tsx)
- props: `{ icon, title, subtitle?, actions? }`. 루트 `items-center`(비상호작용) + 내부 간격만. **너비**: 루트 `w-full`로 부모 폭 채움(축소 방지), actions도 `w-full` 래퍼. flex-1/ScrollView/safe area 없음.
- capture `EmptyState`: 표시부를 ui EmptyState로, hero/스크롤/중앙배치·버튼(useImagePicker)·extra는 capture가 소유(actions로 Button 주입). 두 경로(중앙/스크롤) 유지.

### 1-6. semantic.light 직접 참조 정리
- capture PageList·PageItem·profile FaqSection·entitlement FreeQuotaRow(Ticket 아이콘 색만)·app/index → `color()`/className. FreeQuotaRow 상태 분기 로직 **불변**.

### 1-7. caller 이관 (같은 커밋)
- Button: capture PageList·EmptyState, result ResultScreen(disabled 보존) — label·variant만이라 호환. 취소 버튼은 busy 연결 안 함.
- IconButton: app/index 마이페이지·RecentListScreen 뒤로. PageItem 드래그 핸들 제외(색만 정리).
- nativewind peer `^4.2.6`(package.json).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| Button className/style 차단(허용목록) | semantic API·우회 차단 | caller 유연성↓(현재 불필요) | ✅ |
| cn/tailwind-merge 도입 | override 병합 | native props·inline 미해결·과함(caller 0) | ❌ |
| busy를 화면 active에 일괄 | 간단 | 취소 버튼까지 막힘(회귀) | ❌ → 버튼별 busy |
| IconButton 크기 padding 추정 | 간단 | 터치영역 불확실 | ❌ → minW/H 48 |
| 아이콘 전체 lucide union | 광범위 | 빈 버튼·오타 못잡음 | ❌ → 사용 집합 레지스트리 |
| EmptyState에 scroll/safe area 포함 | 호출 간단 | 두 레이아웃 보존 불가·책임 혼입 | ❌ → 표시 전용 |
| FreeQuotaRow Badge 치환 | 통일 | 상태 분기 손실 | ❌ → 아이콘 색만 |

## 3. 영향받는 코드 (Touched Surface)
- `packages/ui/src/`: button.tsx(재작성)·icon-button.tsx(신규)·icon.tsx(IconName 레지스트리)·section-header.tsx(variant/action)·empty-state.tsx(신규)·index.ts·`*.test.tsx`.
- `apps/mobile`: capture(PageList·PageItem·EmptyState)·profile(FaqSection·ProfileScreen는 IconButton 미해당)·entitlement(FreeQuotaRow 아이콘)·app/index.tsx(마이페이지 IconButton)·documents(RecentListScreen 뒤로 IconButton). result ResultScreen(Button 호환 확인).
- `packages/ui/package.json`(nativewind peer).

## 4. 검증 (Verification)
- **단위(ui)**: Button(disabled/busy 입력 차단·a11y state·상태색·size min-h·fullWidth) · IconButton(최소 크기·a11y label·잘못된 아이콘 처리) · SectionHeader(variant·action button) · EmptyState(actions 렌더·비상호작용 root).
- **단위(mobile)**: 기존 Button caller(ResultScreen disabled) 회귀 없음 · FreeQuotaRow 상태별 출력 불변.
- **타입체크**: mobile + ui(IconName union 적용).
- **시뮬레이터 실측**: 홈(마이페이지 IconButton)·최근목록(뒤로)·분석 진행(PageList 버튼·취소 busy 아님)·빈 상태(capture 두 경로)·프로필(FaqSection 색)·결과(닫기 버튼). 큰 글자·터치영역 눈으로.
- **게이트**: `checks.sh` ALL PASS(ui 포함).

## 5. 리스크 / 롤백
- Button 표면 축소로 숨은 caller 깨짐 → caller 0(className/style) 확인, 이관 같은 커밋. 문제 시 해당 caller만 조정.
- IconName union이 기존 Icon 사용 깨지지 않게 string 하위호환 유지.
- EmptyState 너비 축소 → w-full 계약 + 시뮬 실측. capture 두 경로 스냅 확인.
