# 0065 — 최근목록 리디자인 (TRACE)

- **이슈:** #173

## 2026-10-07

### 착수
- TASK-U4~5 분리 ②(최근목록). #171(마이페이지)에서 만든 공용 ScreenHeader를 소비(develop 머지 확인).
- 확정 시안(Recent-List.dc.html) + 설계 토론(#171과 함께, Claude 서브에이전트) 결론 반영: 부제 헤더 이동·empty EmptyState·DocumentRow 불변.

### 설계 토론
- #171 착수 시 Claude 서브에이전트 적대적 리뷰에서 두 화면 함께 다룸. 최근목록 결론: 자체 상단바→ScreenHeader, ListHeader 부제→헤더 subtitle, empty→EmptyState(py-16 wrapper), DocumentRow 썸네일 이미 48×60이라 손대지 않음.

### 구현·검증
- `RecentListScreen.tsx`: 자체 상단바(IconButton+Text) → 공용 `ScreenHeader title="최근 분석" subtitle="분석 결과는 7일 동안 보관돼요." onBack`. `ListHeaderComponent`(7일 보관 텍스트) 제거(부제 헤더로 이동). `ListEmptyComponent` 인라인 → 공용 `EmptyState icon="FileClock"`(py-16 items-center wrapper로 위치 보존). import 정리(IconButton/Icon/color 제거). FlatList·pull-to-refresh·loadMore·footer·SubscriptionPromoCard·onOpen 불변.
- DocumentRow·구독 카드 손대지 않음(이미 시안 일치).
- 테스트: `RecentListScreen.test.tsx` 신규 3건(헤더 제목+부제·뒤로→onBack·empty EmptyState, documentsStore 목). 기존 documents 단위 불변.
- maestro `recent.yaml`: 변경 불필요(부제·제목·"뒤로"·retention 배지 문구 동일 — 헤더로 옮겨도 assert 통과).
- 게이트: `bash agents/harness/evals/checks.sh` **ALL PASS**(mobile 287·ui 68).
- 남음: 시뮬 육안(헤더 부제·카드·위험도 점·구독 카드) — 백엔드+로그인, 마이페이지와 함께 다음 단계.
