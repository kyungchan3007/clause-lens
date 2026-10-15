# PRD — 메시지·에러 상태 공용 컴포넌트화 + 재구성

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-15
- **이슈:** #198
- **관련 태스크**: 디자인 시스템·FSD (shared-first 승격) — #196 후속

## 1. 문제 (Problem)
중앙 정렬 "문구 + 버튼" 상태 화면이 5곳에 손으로 중복 구현돼 있다(result 3분기·ResultScreen `!current`·RecentList 에러). 또 RecentListScreen 에러는 `RetryInline`을 primary Button처럼 restyle했고, RecentEntryButton 'N건' 진입은 공용 `ListRow`와 같은 모양을 raw Pressable로 재구현했다.

## 2. 목표 (Goals)
- G1. 아이콘 선택적 공용 `MessageState`(title·description·tone·actions)를 신설해 5곳 fallback을 통합.
- G2. RecentListScreen 에러의 RetryInline-흉내-버튼을 실제 공용 `Button`으로.
- G3. RecentEntryButton 'N건' 진입을 공용 `ListRow`(variant=card)로 조합.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 폰트 스케일 밖 크기(11/13/15/17/22px) 처리 — 별도.
- N2. RecentEntryButton의 로딩·에러 상태 변경 — 이번 범위는 'N건' 진입 행만.
- N3. 동작·네비게이션 로직 변경 아님(표현 재구성).

## 4. 사용자 흐름 (User Flow)
사용자 흐름은 동일. 상태 화면들이 공용 컴포넌트로 일관되게 보인다(간격·정렬 정규화로 외형은 소폭 정돈).

## 5. 성공 지표 (Success Metrics)
- 5곳 fallback이 공용 `MessageState` 사용(손그림 View+Text+Button 제거).
- RecentListScreen 에러가 공용 `Button` 사용.
- RecentEntryButton 'N건'이 공용 `ListRow` 사용.

## 6. 제약 (Constraints)
0b-2 원칙 유지 — 공용 컴포넌트는 화면 배치(flex-1·중앙)를 소유하지 않고 호출측이 감싼다. 기존 단위 테스트(RecentEntryButton·RecentListScreen) 호환 유지. 게이트 통과가 조건.

### Acceptance
- [x] 공용 `MessageState` 신설 + 5곳 fallback 통합(result 3·ResultScreen·RecentList)
- [x] RecentListScreen 에러 RetryInline → 공용 Button
- [x] RecentEntryButton 'N건' → 공용 ListRow
- [x] README 공용 UI 목록 최신화 + `MessageState` 단위 테스트
- [x] `bash agents/harness/evals/checks.sh` ALL PASS
- [x] 노션 디자인 시스템·주차 작업 로그 기록

## 7. 애매한 곳·가정 (Open Questions)
- fallback 통합 시 간격·정렬을 `MessageState` 내부 규칙으로 정규화해 사이트별 미세 차이는 수렴시킴 — 사용자가 "레이아웃·시각 변경"을 명시 허용함 (확인됨: 재구성 지시)
