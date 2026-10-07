# PRD — 최근목록 리디자인 (ScreenHeader 소비 + EmptyState)

- **이슈:** #173
- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-07
- **관련 태스크**: TASK-U5(최근목록 — TASK-U4~5 분리 ②)

## 1. 문제 (Problem)
- 최근목록이 자체 인라인 상단바를 그려 #171 공용 `ScreenHeader`와 중복.
- "7일 보관" 안내가 `ListHeaderComponent`라 스크롤 시 사라진다.
- empty 상태가 인라인 Icon+Text(공용 `EmptyState` 미사용).

## 2. 목표 (Goals)
- G1. 공용 `ScreenHeader`(뒤로+"최근 분석"+부제) 사용 — 앱 내 헤더 일관, 부제 고정 노출(시안).
- G2. empty를 공용 `EmptyState`로 통일.
- G3. 동작 불변(documentsStore·페이지네이션·pull-to-refresh·account sync·라우팅).

## 3. 목표가 아닌 것 (Non-goals)
- N1. DocumentRow·SubscriptionPromoCard 재설계(이미 시안 일치).
- N2. 다크모드. 실제 구독·삭제 기능(TASK-006).

## 4. 사용자 흐름 (User Flow)
1. 홈 RecentEntryButton("최근 분석 N건") → /recent 진입.
2. ScreenHeader(뒤로+"최근 분석"+부제) → 문서 카드 목록(pull-to-refresh·무한스크롤) → 하단 구독 예고.
3. 카드 탭 → 결과(result) 재열람. 뒤로 → 홈. 목록 비면 EmptyState.

## 5. 성공 지표 (Success Metrics)
- 시뮬 육안이 시안과 일치(헤더 부제·카드·구독 카드). 동작 불변. checks.sh PASS.

## 6. 제약 (Constraints)
- Expo v57, 새 의존성 없음. 서버 진실·표현만. 색/간격 토큰. 터치 44pt·a11y.

## Acceptance
- [x] 최근목록이 공용 `ScreenHeader`(뒤로+"최근 분석"+부제) 사용, 자체 상단바·ListHeader 텍스트 제거, 부제 고정 노출.
- [x] empty 상태가 공용 `EmptyState`(FileClock+"아직 분석한 계약서가 없어요") — 위치(py-16 중앙) 보존.
- [x] DocumentRow·SubscriptionPromoCard 변경 없음(이미 시안 일치).
- [x] 동작 불변: documentsStore(refresh/loadMore)·pull-to-refresh·무한스크롤·account sync·onOpen/onBack 라우팅 — 표현만 수정.
- [x] 단위(RecentListScreen render 3: 헤더 부제·뒤로·empty EmptyState) + `bash agents/harness/evals/checks.sh` PASS(mobile 287·ui 68).
- [x] 시뮬 육안(헤더 부제·카드·위험도 점·구독 카드) — 2026-10-07 확인: ScreenHeader(뒤로+"최근 분석"+부제 고정), 카드 3건(썸네일·"계약서·1장"·"10/4 · ● 위험 N건"·"3일 후 삭제" pill), red 위험도 점, 하단 구독 예고 카드 모두 시안 일치.

## 7. 미해결 질문 (Open Questions)
- 없음(설계 토론에서 확정).
