<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #196

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/196
- 캡처: 2026-10-14

---
- 배경: 디자인 시스템 최적화 + shared-first 승격 + 토큰 미적용 정리 (앱 전수 스캔 근거)
- IconBadge 일반화: `box`(크기)·`shape` 프롭 추가 — 기본값=현행(h-20·rounded-full)이라 기존 사용처(ProfileScreen) 불변
- 승격: 앱이 손으로 그린 아이콘 배지를 공용 IconBadge로 교체 — ProcessingScreen(위험·완료, 정확 일치)·QuotaExceeded·Hero
- 공용 `Screen` 래퍼 신설(SafeAreaView + bg-background + edges) → 라우트 셸 중복 8곳 제거·profile 분기 정렬
- 토큰화(시각 불변): RecentListScreen `text-white`→`text-primary-foreground`(다크 안전) · IndeterminateBar `borderRadius:999`→`radius.full` · PageCard scrim `rgba(15,23,42,0.7)`→`overlay.scrim` 토큰
- 게이트: `bash agents/harness/evals/checks.sh` ALL PASS (mobile·ui 타입체크 + ui/mobile 단위 + expo-doctor)
- 범위 밖(후속): 폰트 스케일 밖 크기(11/13/15/17/22px) 스냅 or 스케일 확장(시각 결정) · 메시지/에러 상태 컴포넌트화 · RetryInline→Button·RecentEntryButton→ListRow 재구성
