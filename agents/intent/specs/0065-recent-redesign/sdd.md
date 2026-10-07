# SDD — 최근목록 리디자인 (ScreenHeader 소비 + EmptyState)

- **관련 PRD**: 0065-recent-redesign/prd.md
- **이슈:** #173
- **상태**: draft — Claude 설계 토론(2026-10-07, #171과 함께) 반영

## 0. 읽은 문서
- 확정 시안(Recent-List.dc.html), `RecentListScreen.tsx`·`DocumentRow.tsx`·`SubscriptionPromoCard.tsx`·`documentsStore`·`app/recent.tsx`, `packages/ui`(ScreenHeader[#171]·EmptyState·IconButton).

## 1. 접근 (Approach)
- 최근목록 **표현만** 시안 정렬. 데이터·페이지네이션·라우팅 불변.
- #171에서 만든 공용 `ScreenHeader` **소비**(신규 공용 없음). empty만 공용 `EmptyState`로 교체.

## 2. 고려한 대안 (Alternatives / Trade-offs)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 헤더 | 자체 인라인 상단바 유지 | ❌ | #171 ScreenHeader와 중복, 앱 내 헤더 불일치 |
| | **공용 `ScreenHeader` 소비**(title/subtitle/onBack) | ✅ | 헤더 일관, 부제 고정 노출(시안) |
| 부제 | `ListHeaderComponent` 텍스트 유지 | ❌ | 스크롤 시 사라짐 → 시안 의도(헤더 고정)와 불일치 |
| | **헤더 subtitle로 이동** | ✅ | 고정 노출 |
| empty | 인라인 Icon+Text 유지 | 🟡 | 동작 무방이나 공용 미사용 |
| | **공용 `EmptyState`(FileClock) + py-16 items-center wrapper** | ✅ | 공용 일관, EmptyState는 중앙배치 미소유라 wrapper로 위치 보존 |
| DocumentRow | 썸네일/위험도/retention 손보기 | ❌ | 이미 48×60·riskTone·retention badge 시안 일치 → regression 리스크만 |
| 구독 카드 | 재설계 | ❌ | SubscriptionPromoCard 이미 근접 |

## 3. 영향받는 코드 / 순서 (Touched Surface & Plan)
1. **`features/documents/ui/RecentListScreen.tsx`**:
   - 자체 상단바(IconButton+"최근 분석") → `<ScreenHeader title="최근 분석" subtitle="분석 결과는 7일 동안 보관돼요." onBack={onBack} />`.
   - `ListHeaderComponent`(7일 보관 텍스트) 제거.
   - `ListEmptyComponent` 인라인 → `<View className="items-center py-16"><EmptyState icon="FileClock" title="아직 분석한 계약서가 없어요" subtitle=... /></View>`(위치 보존).
   - FlatList·pull-to-refresh·loadMore·footer·SubscriptionPromoCard·onOpen 불변.
2. (선택) `DocumentRow.tsx` stale 주석("홈 최근·목록 공용") 정리 — 홈은 썸네일 미사용. 코드 동작 불변.
3. **테스트**: RecentListScreen render 단위 — (a)헤더 "최근 분석"+부제 노출, (b)items 비면 EmptyState("아직 분석한 계약서가 없어요") 노출, (c)onBack 연결. documentsStore는 목. 기존 DocumentRow.test(doc-thumb-placeholder)·단위 불변.

## 4. 위험과 완화 (Risks)
- R1 ScreenHeader 소비 시 레이아웃(FlatList가 헤더 아래 채움) — recent.tsx는 SafeAreaView+View라 안전(헤더 고정, 리스트 flex-1).
- R2 EmptyState 중앙배치 미소유 → py-16 items-center wrapper 유지로 현재 위치 보존.
- R3 documentsStore·페이지네이션 불변 — 표현만 수정.

## 5. 검증 (Verification)
- **단위**: RecentListScreen render(헤더 부제·empty EmptyState·onBack). 기존 documents 단위(retentionBadge·DocumentRow) 불변.
- **게이트**: `bash agents/harness/evals/checks.sh` PASS.
- **maestro**: 홈→최근목록(헤더·부제)→문서 열기→뒤로.
- **시뮬 육안(다음)**: 헤더 부제·카드·위험도 점·구독 카드.
