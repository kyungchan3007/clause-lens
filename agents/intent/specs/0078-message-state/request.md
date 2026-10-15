<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #198

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/198
- 캡처: 2026-10-15

---
- 중앙 "문구+버튼" fallback 5곳 중복 → 아이콘 선택적 공용 `MessageState` 컴포넌트로 통합(result 3분기·ResultScreen `!current`·RecentList 에러)
- RecentListScreen 에러: RetryInline을 primary Button처럼 restyle → 실제 공용 `Button`으로
- RecentEntryButton 'N건' 진입: 손그림 Pressable(아이콘+제목+chevron) → 공용 `ListRow`(variant=card) 조합
- README 공용 UI 목록 최신화(Screen·MessageState 등)
- 외형 변경 포함(레이아웃·간격 정규화 허용) · `MessageState` 단위 테스트 추가 · 기존 테스트 호환 유지
- 게이트: `bash agents/harness/evals/checks.sh` ALL PASS
- 기록: 노션 디자인 시스템 + 주차 작업 로그
- 범위 밖: 폰트 스케일 밖 크기(별도)
