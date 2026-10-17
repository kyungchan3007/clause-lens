# TRACE — identify 매핑 + 재동기화 (#165 Slice 4A, 서버)

- 2026-10-17 착수. #165 5슬라이스 중 Slice 4. 브랜치 `feat/165-purchase-identify`(base=develop, Slice 1~3 머지 포함).
- **Codex 리뷰(세션 baa9hothz) 반영**: 블로커 2·중대 다수.
  - [블로커 A] identify ≠ 구매 소유권 증명 — appUserID를 클라가 설정하므로 내부 매핑 위조만 막음. "서버 검증 계정 연결" 과장 → **내부 매핑 생성만 안전**으로 재서술, 진짜 소유권 증명(영수증 검증/secure logIn)은 출시 전 과제.
  - [블로커 D] restore 이전 정책 공백 → **기존 소유자 유지·자동 이전 거부**(사용자 확정, resolveOwnership 일치), 충돌 시 미부여+중립 안내(UI는 4B).
  - [중대 B] /me/access 변화는 구매 완료 증거 아님(이미 구독 중이면 불변) → 완료 판정은 서버 동기화 상태 기준, 폴링 제한 = 4B.
  - [중대 C] Fake로 네이티브 통합 미검증 → SDK 설치·실 어댑터·로딩 경계 = 4B.
  - [중대 E] 로그인 1회 identify 부족·skip된 이벤트 재처리 미보장 → identify 직후 **reconcileCustomer 재동기화**로 매핑 전 구독 흡수, upsert는 타 소유자 덮어쓰기 금지.
  - [중대 E2] SDK 계정 전환 수명주기 = 4B.
  - [경미 F] 4A/4B 분리.
- **사용자 결정**: Slice 4A(서버부터) · 이전 정책 기존 소유자 유지. (앱 UI는 4B)
- 반영본 = sdd.md. 원 지적 전문: scratchpad/codex-slice4-out.txt.

<!-- 이후: 구현 → 테스트/게이트 -->

- **구현 완료(2026-10-17)**:
  - 계약 `billingIdentifyResponseSchema`(contracts/billing.ts) + index export.
  - `BillingIdentifyService.identify(userId, now)`: 멱등 매핑 확보(create-only·P2002 무해·타 소유자 Conflict) + `reconcileCustomer` 재동기화. customerId=userId 서버 파생.
  - `BillingController` `POST /me/billing/identify`(JwtAuthGuard·HttpCode 200). 신규 `BillingModule`(Auth+Subscriptions) → AppModule.
- **테스트**: 단위 — 서비스 7(생성·멱등·Conflict·P2002·기타예외·outcome 정규화·공급자실패)·컨트롤러 1 = 8. e2e(실 DB 서비스 레벨) 3(매핑 영속·멱등·매핑 전 구독 흡수).
- **e2e 플래키 수정**: 여러 e2e 파일이 한 Postgres에 병렬 실행돼 간헐 실패(1회 관측) → `jest-e2e.json`에 `maxWorkers:1`(직렬) 추가로 결정적화.
- **게이트**: `checks.sh` ALL PASS + `db-e2e.sh` 19건 통과.
- **출시 전 과제(블로커 A)**: 구매 소유권 증명(서버 영수증 검증 / RevenueCat secure logIn) — 4A 범위 밖, Notion 13 기록.
