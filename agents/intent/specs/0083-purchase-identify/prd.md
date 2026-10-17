# PRD — identify 매핑 + 재동기화 (#165 Slice 4A, 서버)

> Codex 리뷰·사용자 결정으로 Slice 4를 **4A(서버)**/4B(앱)로 분리. 이 문서 = 4A. 앱 SDK·구매/복원 UI·수명주기·구매 후 폴링 = **4B**(후속).

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-17
- **이슈:** #165 (TASK-006 ④)
- **관련**: 서버 Slice 1~3(동기화·웹훅·재시도/대사) 머지 완료. 이 슬라이스 = 앱 결제 흐름 + 매핑 생성(서버가 미뤄둔 BillingCustomer 생성). 설계: ADR-12 + Codex(2026-10-17 Slice 4 리뷰).

## 1. 문제 (Problem)
- 서버 파이프라인(Slice 1~3)은 `BillingCustomer(provider, customerId)→userId` 매핑이 있어야 구독을 반영한다. 웹훅은 매핑 없으면 unmapped skip. **매핑 생성 주체가 없다**(Slice 2/3에서 "웹훅 인증≠소유권"이라 미룸).
- 앱엔 구독 상품·구매·복원 UI가 없다(`SubscriptionPromoCard`는 "곧 제공" placeholder).

## 2. 목표 (Goals)
- G1. **서버 identify** — 인증된 사용자가 자신의 RevenueCat 고객 매핑을 **서버 검증으로** 생성(멱등). 클라이언트 입력 불신(서버가 userId에서 파생).
- G2. **앱 구독 포트** — `getOfferings·purchase·restore` 추상화 + RevenueCat 어댑터(실 SDK) + Fake(dev/테스트).
- G3. **구매↔권한 분리** — 구매 성공만으로 권한 X. 구매/복원 후 `GET /me/access`로 서버 반영 확인(폴링·타임아웃·고지).
- G4. **구독 화면** — placeholder 교체: 플랜 안내·구독·복원·상태. 디자인 시스템 준수.
- 정책: Google(Android) 먼저·Apple 보류, 코드는 iOS 동등. 계정·스토어 없이 Fake로 완성(실 키·스토어는 배포).

## 3. 목표가 아닌 것 (Non-goals)
- N1. **앱 측 전부 → Slice 4B**: RevenueCat SDK 설치·구매/복원 UI·계정 수명주기(로그아웃·전환)·구매 후 /me/access 폴링.
- N2. **구매 소유권 증명**(서버 영수증 검증 / RevenueCat secure logIn) → 출시 전 과제(이 슬라이스는 내부 매핑 생성만 안전하게). 블로커 A.
- N3. 샌드박스 양 플랫폼 출시 검증 → Slice 5. 실 계정·스토어·결제 → 배포/운영.

## 4. 사용자 흐름 (User Flow)
로그인 → 앱이 RevenueCat을 userId로 식별 + 서버 identify(매핑 생성) → 구독 화면에서 구독하기 → 스토어 결제 → (스토어→RevenueCat→웹훅→서버 동기화) → 앱이 /me/access 폴링으로 보관 권한 반영 확인 → UI 갱신. 복원: restore → 동일 확인 흐름.

## 5. 성공 지표
- identify로 매핑 생성 후 웹훅/대사가 구독을 반영(end-to-end 연결 완성).
- 구매 성공 후 서버 미반영 동안 "구매 확인 중", 반영되면 보관 권한 UI 갱신. 미반영 타임아웃 시 안내.
- `checks.sh` ALL PASS + 앱 단위/e2e.

### Acceptance (4A)
- [x] `POST /me/billing/identify`(JwtAuthGuard·멱등) — 매핑 생성·타 소유자 덮어쓰기 금지·클라 app_user_id 불신
- [x] 최초 연결 직후 재동기화(reconcileCustomer) — 매핑 전 도착 구독 흡수
- [x] 계약 `billingIdentifyResponseSchema`(contracts)
- [x] 소유권/복원 정책(기존 소유자 유지) 문서화 + 소유권 증명 공백 출시 전 과제 기록
- [x] 단위(생성·멱등·Conflict·P2002·재동기화) + 컨트롤러 단위 + e2e(실 DB 서비스 레벨)
- [x] `checks.sh` ALL PASS + `db-e2e.sh`

## 6. 제약
- 서버가 진실. 구매 성공만으로 권한 부여 금지. 비밀값 env. 토큰·URL 로그 금지.
- 매핑은 서버 검증으로만 생성(클라 app_user_id 불신). 공유 UI는 shared-first.

## 7. 애매한 곳·가정 (Open Questions)
- 슬라이스 분할: 4A(서버)/4B(앱) (확인됨: 사용자 "A. 서버부터")
- 이전 정책: 기존 소유자 유지·자동 이전 거부(기존 resolveOwnership 일치) (확인됨: 사용자 "기존 소유자 유지")
- identify는 customerId=userId 서버 파생·클라 app_user_id 불신 — **내부 매핑 생성만 안전**, 구매 소유권 증명 아님 (확인됨: Codex 블로커 A, 출시 전 과제로 분리)
- 매핑 전 도착 구독은 identify 직후 reconcileCustomer로 흡수(로그인 1회로 불충분 보완) (확인됨: Codex 중대 E)
- 구매 후 권한 폴링·SDK 설치·계정 수명주기 = 4B (확인됨: 범위 분리)
