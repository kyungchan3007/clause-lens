# 0039 — 과정 기록 (trace)

## 판단
- 사용자 요청: 시안에 있으나 미구현인 ⑥ 무료 소진(403) 화면 + ⑨ 최근 목록 "구독 알아보기" 버튼. "일단 구현"(설계=주어진 시안, Codex 생략).
- 403은 analysis error로 들어옴(기존 메시지 "현재 사용할 수 있는 무료 분석 횟수가 없어요") → **errorKind="quota"**로 분기해 전용 화면. 제네릭 error는 ProcessingScreen 유지.
- 버튼 동작(시안에 명시 없어 합리적 기본): 확인=기존 onCancel(idle 복귀·담은 페이지 유지) · 남은 분석 상태 보기=/recent · 구독 알아보기=Alert 안내(구독 미구현).
- 구독 카드는 /recent 하단 고정(FlatList 밖) — 시안이 스크롤과 무관한 하단 배치.

## 막힘 / 되돌림
- 403 분기: analysisStore `errorKind?: "quota"` 추가·reset 비움. useAnalysis 403이면 errorKind="quota". app/index merged에 errorKind 포함 → `hasPages && phase==="error" && errorKind==="quota"`면 QuotaExceededScreen(기존 ProcessingScreen error 앞 분기).
- 확인=onCancel 재사용(분석 error 닫고 idle→PageList, 담은 페이지 유지). 남은 상태 보기=/recent.
- QuotaExceededScreen(entitlement/ui): 티켓(warning-bg·warning)·제목·부제·구독 Notice(Star)·확인/상태보기. SubscriptionPromoCard(documents/ui): primary-tint 카드·ShieldCheck·"구독 알아보기 (곧 제공)"→Alert. RecentListScreen 하단 FlatList 밖 고정(items>0).
- 아이콘 Star 레지스트리 추가(Notice용). Ticket·ShieldCheck 기존.
- 단위: QuotaExceededScreen 2·SubscriptionPromoCard 2.
