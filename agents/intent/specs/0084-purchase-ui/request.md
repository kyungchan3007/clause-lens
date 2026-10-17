<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #165

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/165
- 캡처: 2026-10-17 (Slice 4B 착수)

---
## 요약
- TASK-006 ④ — 인앱결제(IAP) 연동, RevenueCat 경유
- 설계: ADR-12 (결제 수단 IAP+RevenueCat 확정)

## 설계
- 내부 `SubscriptionProvider` 포트 뒤에 RevenueCat
  - 앱 성공 응답만으로 권한 X → 서버가 검증된 상태만 반영
- 서버
  - 구매·복원 → 영수증/구독 증빙 검증
  - 플랫폼 알림 수신(App Store Server Notifications / Google RTDN 또는 RevenueCat 웹훅)
  - 이벤트 영속·중복 제거 → 최신 공급자 상태 재조회 → 트랜잭션 반영
  - 정기 대사(역순·지연·누락 알림 대비)
  - 외부 구독ID 계정 간 중복 귀속 차단
- 앱
  - 구독 상품·구매·복원 UI (SubscriptionPromoCard placeholder 교체)

## 완료 조건
- [ ] SubscriptionProvider 포트 + RevenueCat 어댑터
- [ ] 서버 검증·플랫폼 알림 → 구독 상태 갱신(멱등) + 단위
- [ ] 구매·복원 앱 흐름
- [ ] 월간·연간·취소·환불·복원 샌드박스 검증(양 플랫폼)
- [ ] `checks.sh` PASS
