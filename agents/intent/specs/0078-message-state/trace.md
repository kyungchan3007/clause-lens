# TRACE — 메시지·에러 상태 공용 컴포넌트화 + 재구성 (#198)

- 2026-10-15 착수. #196(디자인 시스템 1차) 후속으로 사용자가 지정: 메시지/에러 상태 컴포넌트화 + RetryInline→Button + RecentEntryButton→ListRow. "이거만" (폰트 스케일 제외). + README 최신화 + 노션(디자인 시스템·주차 로그) 기록.
- 컴포넌트 선택: EmptyState는 icon 필수 설계라 아이콘 없는 에러 fallback에 부적합 → icon·title 모두 선택적인 신규 MessageState.
- 테스트 호환 선검토: RecentEntryButton 'N건'만 ListRow로(에러/로딩 유지) → 기존 테스트의 "다시 시도"·role=button·제목 assert 모두 통과 예상. RecentListScreen 테스트는 ready 상태라 에러 재구성과 무관.

- 구현 완료: MessageState 신설(icon·title 선택적, tone danger, actions=EmptyState와 동일 w-full). result.tsx 3분기·ResultScreen !current·RecentListScreen 에러를 MessageState로. RecentListScreen 에러 RetryInline→Button. RecentEntryButton 'N건'→ListRow(card). README 공용 UI 목록 갱신.
- 테스트: message-state.test.tsx 5개 통과. 기존 RecentEntryButton·RecentListScreen 7개 통과(ListRow가 role=button·onPress·제목 유지). checks.sh ALL PASS.
