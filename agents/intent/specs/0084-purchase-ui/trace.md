# TRACE — 앱 구매/복원 UI + 수명주기·폴링 (#165 Slice 4B, 앱)

- 2026-10-17 착수. #165 Slice 4B. 브랜치 `feat/165-purchase-ui`(base=develop, 4A 포함).
- **Codex 리뷰(세션 b01zi1wtq) 반영**: 블로커 2·중대 5.
  - [블로커 A] /me/access·identify.synced로 "이번 거래 완료" 판정 불가(기존 구독자 불변·applied=0 멱등) → **분리 상태**(스토어 성공/서버 확인중/권한), access는 권한 UI 갱신만, 거래 확정 서버 계약은 후속.
  - [블로커 C] 세션 토큰 폐기만으론 SDK 계정 레이스 미방지 → **coordinator 직렬화 + generation 폐기**(userId 변경 반응·single-flight·로그아웃 무효화·늦은 콜백이 새 계정 토큰으로 identify 호출 차단).
  - [중대 A·D] 폴링 대상/상한 후 상태 → identify(재동기화 트리거)+access 폴링·전체 마감·요청 타임아웃, 마감 후 "확인 지연"(재확인=재구매 아님), 작업 수명은 화면 바깥 계정별.
  - [중대 B] 스텁≠실 어댑터 검증 → **Fake 기반 흐름으로 한정**, 실 SDK 설치·네이티브 검증 후속, 배포 미설정=사용불가(Fake 자동선택 금지).
  - [중대 E] restore 성공≠권한 복구 → no_target/delayed/conflict 분리, 충돌 중립 안내.
  - [중대 D] 401 재시도는 같은 사용자·세대만 — shared client 미변경(한계 기록), coordinator generation 폐기로 UI/후속 차단.
  - [중대 F] 전체 4B 완료 주장 금지 → Fake 흐름 범위 명시, 핵심 케이스 테스트.
- 반영본 = sdd.md. 원 지적 전문: scratchpad/codex-slice4b-out.txt.

<!-- 이후: 구현 → 테스트/게이트 -->

- **구현 완료(2026-10-17)**:
  - `features/subscription`: purchasePort(getOfferings·purchase·restore·configure·logOut) + FakePurchases(기본·dev) + RevenueCatPurchases 스텁(미설정 명확 실패·lazy require 자리) + selectPurchasePort(Fake는 명시 플래그만).
  - subscriptionStore: 기존 accountScopedStore(generation 격리) 재사용 + single-flight + 확인 상태기계(purchasing/restoring/confirming/active/delayed/no_target/conflict/cancelled/error). confirm=identify(재동기화 트리거)→/me/access 제한 폴링(전체 마감·세대 가드). 재확인=recheck(재구매 아님).
  - billingApi(identify·fetchAccess 계약 검증), useSubscriptionAccount(userId 변경 반응 — _layout authed 마운트), SubscriptionScreen(플랜·구독·복원·상태), 라우트 app/subscription.tsx, SubscriptionPromoCard→onPress 콜백(피처 네비 비의존)·recent 라우트 주입.
- **테스트**: store 13(active·delayed·멱등 applied=0·취소·충돌·복원·recheck 비재구매·single-flight·계정 전환 폐기·offerings) + 화면 5(플랜·상태별 배너·구독 탭) + promo 2 = 20. maestro S23(subscription.yaml, Fake 빌드 실행은 디바이스 후속). getAccessToken 모킹은 resetMocks 대비 beforeEach impl 세팅(entitlement 패턴).
- **게이트**: `checks.sh` ALL PASS(모바일 타입체크·전체 단위·expo-doctor 포함). DB 변경 없음(앱 전용).
- **범위 한계(Codex)**: Fake 기반 앱 흐름까지. 실 RevenueCat SDK 설치·네이티브 빌드 검증·실 결제 = 후속. 서버의 "이번 거래 반영 확정" 계약 부재 → 분리 상태로 대체(완료 단정 금지).
