# 0034 — Button·IconButton·SectionHeader·EmptyState + semantic.light 직접 참조 정리 (순서 0b-2) — PRD

> **이슈:** #101 · **관련 태스크**: #101 (task, TASK-U0b2) · **상태**: in-progress · **유형**: 기반 (디자인 시스템 · 공통 컴포넌트)

## 1. 문제
0b-1(ListRow·Badge tone·StatusDot)에 이어, 버튼/빈상태/섹션헤더 계열 공통 컴포넌트와 **잔여 `semantic.light` 직접 참조**를 정리한다. 현재 Button은 h-12 고정·`{...props}` spread로 스타일 우회 가능하고 busy/disabled 상태·상태색 전달이 없으며, IconButton·표시용 EmptyState·SectionHeader action이 없다. 착수 전 Codex 설계 토론 → 수렴안. BrandHeader·Notice·card shadow는 순서1(홈)로.

## 2. 목표
- G1. **Button 확장**: 스타일 표면 차단(className·style·무제한 spread 제거, 허용 native props만) · `size`(min-h, Android 일관 48) · `fullWidth`(기본 배치 보존) · `busy`/`disabled`(차단+a11y, 스피너=선행 슬롯·label 유지) · 상태색 내부 1회 매핑(Text class / Icon·spinner color()).
- G2. **IconButton**(신설): `minWidth/minHeight` 하한 48 · accessibilityLabel 필수 · 아이콘 레지스트리(빈 활성 버튼 금지). app/index 마이페이지·RecentListScreen 뒤로 이관.
- G3. **SectionHeader** `variant`(label/title)+`action`(형제 Pressable) + 여백 소유권 명시.
- G4. **EmptyState**(표시 전용): icon·title·subtitle·actions, 너비 계약(축소 방지), flex-1/ScrollView/safe area는 capture 소유. capture 두 경로(중앙/스크롤) 보존.
- G5. **semantic.light 직접 참조 정리**: capture(PageList·PageItem)·profile(FaqSection)·entitlement(FreeQuotaRow 아이콘)·app/index → className/`color()`. FreeQuotaRow 상태 분기 보존.
- G6. nativewind peer `>=4.2.0`→`^4.2.6`(차기 major 차단).

## 3. 목표가 아닌 것 (Non-goals)
- N1. BrandHeader·Notice·card shadow = 순서1(홈)에서 실제 소비 확인 후.
- N2. cn/tailwind-merge 도입 · 화면 리디자인 · 다크 · Chip.
- N3. FreeQuotaRow를 Badge로 교체 · PageItem 드래그 핸들을 onPress 전용 IconButton으로 교체(회귀) · 진행률 width·이미지 크기 inline style(색 아님).
- N4. 홈 SectionHeader 적용(순서1) — 이번은 컴포넌트·API 검증만.

## 4. 제약 (Constraints)
- `ui → tokens`만. 정적색=className / 색 prop=`color()`. 동작·접근성 회귀 금지(특히 ResultScreen disabled·PageList 취소 busy).
- base=develop(0a·0b-1 포함). 완료 전 `checks.sh` PASS(ui 포함).

## Acceptance
- [x] Button: className·style·무제한 spread 차단(허용 native props만), `size`(min-h·Android 48)·`fullWidth`(기본 배치 보존)·`busy`/`disabled`(a11y state·입력 차단)·상태색(Text/Icon/spinner). 기존 caller(disabled 포함) 회귀 없음. 단위 테스트.
- [x] IconButton: 실제 영역 ≥48×48·accessibilityLabel 필수·아이콘 레지스트리(잘못된 이름 방지). app/index·RecentListScreen 이관.
- [x] SectionHeader `variant`(label/title)+`action`(형제 button), 여백 이중 안 됨. 단위 테스트.
- [x] EmptyState(표시 전용) 신설·capture 두 경로 보존(0건 extra 경로 유지). 너비 축소 없음.
- [x] 잔여 `semantic.light` 직접 참조 0건(FaqSection 포함), FreeQuotaRow 상태 분기 보존.
- [x] nativewind peer `^4.2.6`. 단위(ui+mobile) + 시뮬레이터 실측 + 게이트 PASS.
