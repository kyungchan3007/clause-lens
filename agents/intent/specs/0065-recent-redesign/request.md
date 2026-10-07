<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #173

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/173
- 캡처: 2026-10-07

---
## 배경
- 최근목록이 자체 인라인 상단바(IconButton+"최근 분석")를 그림 → #171의 공용 `ScreenHeader`로 통일 가능
- "7일 보관" 안내가 `ListHeaderComponent`라 스크롤하면 사라짐
- empty 상태가 인라인 Icon+Text (공용 EmptyState 미사용)

## 요구 (확정 시안)
- 헤더: 뒤로 + "최근 분석" + 부제 "분석 결과는 7일 동안 보관돼요."(헤더 안, 타이틀 아래)
- 문서 카드(DocumentRow): 썸네일·제목·날짜·위험도 점+건수·"N일 후 삭제" pill — 이미 시안 일치(변경 없음)
- 하단 구독 예고 카드(SubscriptionPromoCard): 이미 근접(유지)

## 설계 (Claude 설계 토론 반영 — #171과 함께 다룸, spec)
- 자체 상단바 → 공용 `ScreenHeader title="최근 분석" subtitle=... onBack` (부제 헤더로 이동, ListHeader 텍스트 제거)
- empty → 공용 `EmptyState`(FileClock) + `py-16 items-center` wrapper로 위치 보존
- DocumentRow 썸네일(이미 48×60)·위험도 점·retention badge는 손대지 않음
- 동작 불변: documentsStore·페이지네이션·pull-to-refresh·account sync·라우팅

## Acceptance
- [ ] 최근목록이 공용 `ScreenHeader`(뒤로+"최근 분석"+부제) 사용, 자체 상단바·ListHeader 텍스트 제거, 부제 고정 노출
- [ ] empty 상태가 공용 `EmptyState`(FileClock+"아직 분석한 계약서가 없어요") — 위치(py-16 중앙) 보존
- [ ] DocumentRow·SubscriptionPromoCard 변경 없음(이미 시안 일치)
- [ ] 동작 불변: documentsStore(refresh/loadMore/removeDocument)·pull-to-refresh·무한스크롤·account sync·onOpen/onBack 라우팅
- [ ] 단위(RecentListScreen render: 헤더 부제·empty EmptyState) + `bash agents/harness/evals/checks.sh` PASS + 시뮬 육안

## 범위 밖
- DocumentRow/구독 카드 재설계, 다크모드, 실제 구독·삭제 기능(TASK-006)
