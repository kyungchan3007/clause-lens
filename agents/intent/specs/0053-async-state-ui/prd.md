# PRD — 비동기 상태(로딩·에러-재시도) 인라인 UI 공통화

> **이슈:** #147 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
"로딩 스피너" 와 "에러 → 재시도 Pressable(danger 텍스트)" 가 **4개 소비처에 손그림으로 복붙**되어 drift 위험이 있다.

- `apps/mobile/src/features/entitlement/ui/FreeQuotaRow.tsx` · `FreeQuotaChip.tsx`
- `apps/mobile/src/features/documents/ui/RecentEntryButton.tsx` · `RecentListScreen.tsx`

각 곳이 `<ActivityIndicator accessibilityLabel=…>` 와 `<Pressable accessibilityRole="button" onPress={refresh}><Text className="text-sm text-danger">…</Text></Pressable>` 패턴을 **거의 동일하게 재작성**(총 5개 스피너 · 4개 재시도). 접근성 라벨 누락·danger 색 상수 drift 위험.

## 2. 목표 (Goals)
- G1. `packages/ui`에 표시 전용 공통 컴포넌트 추가 — `LoadingIndicator`(로딩=ActivityIndicator + 필수 a11y 라벨) · `RetryInline`(에러=재시도 Pressable, 기본 danger 텍스트).
- G2. 소비처 4곳이 손그림을 제거하고 공통 컴포넌트를 소비. **스토어 구독·분기 로직은 호출부 유지**(표현만 공통화).
- G3. 소비처별 레이아웃·문구·a11y 차이를 **props로 흡수**(억지 통일 없이 1:1 재현).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 외부 동작 변경 — 4곳의 로딩 표시·에러 문구·재시도 onPress·접근성 라벨 **완전 불변**. 다르면 통일하지 않고 그대로 재현.
- N2. 상태 판정/데이터 로직을 ui로 이동(서버가 진실 · ui는 표시 전용). status enum·refresh는 호출부 소유.
- N3. 로딩/에러 바깥 컨테이너(카드·정렬·filled 배경) 통일 — 컨테이너는 호출부가 소유.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 무료 분석 행·칩, 최근 분석 진입 버튼·목록 화면의 로딩 스피너·에러 재시도 모양·문구·동작 모두 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(ui·mobile 타입 + 유닛 포함).
- 기존 `FreeQuotaChip`·`RecentEntryButton` 테스트 **무수정 통과**(동작 불변 증거).
- 손그림 스피너 5곳·재시도 Pressable 4곳 → 공통 컴포넌트 2개 소비.

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. 로딩/에러를 `status` 하나로 받는 단일 `AsyncState`가 더 간결할지 — 소비처가 ready/idle 등 더 풍부한 자체 status로 분기하므로 dead prop(빈 라벨)을 유발. 현재는 로딩·에러 두 책임을 분리한 2컴포넌트가 더 깔끔(후속 재검토).

### Acceptance
- [x] `packages/ui/src/async-state.tsx`에 `LoadingIndicator`(label 필수·size?) · `RetryInline`(onRetry·label·className?·textClassName?·accessibilityLabel?·hitSlop?·children?) 추가, index export.
- [x] FreeQuotaRow: 로딩→`LoadingIndicator`, 에러→`RetryInline`(기본 danger 텍스트). 문구·onPress 불변.
- [x] FreeQuotaChip: 로딩→`LoadingIndicator size="small"`, 에러→`RetryInline`(children=Badge danger, accessibilityLabel·hitSlop·className 유지).
- [x] RecentEntryButton: 로딩→카드 안 `LoadingIndicator`, 에러→카드 `RetryInline`(className 유지). 바깥 View 유지.
- [x] RecentListScreen: 중앙 로딩·푸터 로딩→`LoadingIndicator`, 에러→`RetryInline`(filled className + white textClassName), 메시지 Text는 호출부 유지.
- [x] 공통 컴포넌트 단위 테스트 추가(로딩·에러-재시도·a11y).
- [x] `bash agents/harness/evals/checks.sh` ALL PASS, 기존 테스트 무수정 통과.
