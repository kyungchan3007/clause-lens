# PRD — RevenueCat 실연결: REST 어댑터·웹훅 수신·인증 (서버, #165 Slice 2)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-15
- **이슈:** #165 (TASK-006 ④)
- **관련 태스크**: 인앱결제 IAP+RevenueCat — 서버 두 번째 슬라이스(실연결). 설계: ADR-12 + Codex(Slice 1 session 01a13e33 분할, Slice 2 리뷰 2026-10-15). 선행: [0079-subscription-sync-core](../0079-subscription-sync-core/prd.md).

## 1. 문제 (Problem)
Slice 1이 동기화 핵심(수신함 멱등·소유권·stale 펜싱·투영)을 `BillingProviderPort` 뒤에 깔았지만 **실 공급자 어댑터가 없고(Unconfigured) 운영 웹훅 라우트도 비활성**이라, 실제 RevenueCat 이벤트가 서버로 흐르지 못한다. 이 슬라이스는 **실 RevenueCat REST 어댑터 + 인증된 웹훅 라우트 + 설정 바인딩**을 더해 운영 경로를 활성화한다(계정·키 없이 목으로 완성, 실제 키는 배포 env).

## 2. 목표 (Goals)
- G1. **RevenueCatBillingProvider** — `BillingProviderPort.getSubscriberState`를 v1 `GET /subscribers/{app_user_id}`(Bearer secret)로 구현. 응답 → `ProviderSubscriptionSnapshot[]` 매핑(활성여부 직접 계산).
- G2. **운영 웹훅 라우트** `POST /billing/revenuecat/webhook`(공개) — **raw body** 기반 정적 `Authorization` 헤더(상수시간) + 선택 HMAC(`X-RevenueCat-Webhook-Signature`, 5분) 검증 → payload를 `IncomingSubscriptionEvent`로 매핑 → `SubscriptionSyncService.processEvent`. **HTTP 상태로 RC 재시도 의미 표현**.
- G3. **설정 바인딩** — env(`REVENUECAT_SECRET_KEY` 등) 있으면 실 어댑터, 없으면 기존 `UnconfiguredBillingProvider`(안전 비활성). `BillingCustomer` 매핑은 **해당 id의 User가 존재할 때만** lazy 생성(유령 매핑 금지).
- G4. 어댑터 단위(목 fetch)·웹훅 컨트롤러 단위(인증 성공/실패/HMAC)·통합 e2e(공개 라우트 POST → 수신함 영속·멱등·unmapped·상태코드).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 스케줄 **재시도 실행 루프**·정기 대사·누락 탐지·운영 알림 → Slice 3(수신함 `nextRetryAt`만 남기고 실행은 안 함).
- N2. 앱 구독 상품·구매·복원 UI·앱 포트 → Slice 4.
- N3. 월간·연간·취소·환불·복원 **샌드박스 양 플랫폼 출시 검증** → Slice 5.
- N4. 실제 RevenueCat 계정·대시보드 설정·실 키 — 배포/운영 작업(코드는 env 주입만).

## 4. 사용자 흐름 (User Flow)
(서버 관점) RevenueCat 웹훅 → 라우트가 raw body로 인증(정적+HMAC) → 멱등 수신함 저장 → **공급자 현재 상태 재조회(REST)** → 정규화·소유권·stale → `Subscription` 반영. 권한 판정은 기존 `GET /me/access`(불변). 앱은 아직 관여 안 함(Slice 4).

## 5. 성공 지표 (Success Metrics)
- 어댑터: RC 응답 샘플 → snapshot 매핑 정확(active/grace/expired·autoRenew·period·externalId), 네트워크/비2xx → `ok:false`(기존 유지).
- 웹훅: 정적 헤더 불일치·HMAC 불일치·타임스탬프 만료 → 401, 위조 차단. 정상 → 처리 결과에 맞는 상태코드.
- 멱등: 같은 `event.id` 재전송 → 중복 no-op(수신함 유니크).
- `bash agents/harness/evals/checks.sh` ALL PASS.

### Acceptance
- [x] `RevenueCatBillingProvider`(v1 subscribers) + 응답→snapshot 매핑 + 단위(목 fetch: active/grace/expired/unknown store·product/404/네트워크/sandbox 헤더, 9케이스)
- [x] 웹훅 라우트(공개·raw body) + 정적 Authorization + 선택 HMAC(5분·상수시간·형식) 검증 + 단위(성공/위조/만료/형식/미설정 거부)
- [x] payload→`IncomingSubscriptionEvent` 매핑 + `SubscriptionSyncService` 연결 + HTTP 상태 매핑(provider_error 503·그 외 2xx)
- [x] 설정 바인딩(env 있으면 실 어댑터·없으면 Unconfigured, 활성 시 필수설정 검증) + **lazy 매핑 제거**(기존 매핑만, 생성은 Slice 4)
- [x] 통합 e2e(실 Postgres + Nest HTTP, 공개 라우트 POST): HMAC 바이트검증·멱등·unmapped·sandbox skip·provider_error 503·bad auth 401 (7케이스)
- [x] 재진입 안전(processed만 duplicate·failed 재처리) + 환경 게이트 서비스 단위(Codex 블로커 A·C 반영)
- [x] `bash agents/harness/evals/checks.sh` ALL PASS + `bash scripts/db-e2e.sh`

## 6. 제약 (Constraints)
- 서버가 진실. **웹훅=재조회 트리거**(payload 맹목 적용 금지). 인증은 **파싱 전 raw body**로.
- 비밀값은 env. 미설정이면 운영 경로 안전 비활성(Unconfigured). 알 수 없는 app_user_id로 유령 매핑 금지.
- iOS·Android 양 플랫폼 불문(코드). RC 60초/비2xx 재시도 규칙 준수.

## 7. 애매한 곳·가정 (Open Questions)
- app_user_id = 우리 `userId`로 앱이 RevenueCat을 설정한다는 전제(RC 권장·"Keep with original App User ID" 소유권과 일치) (가정)
- 웹훅 매핑 생성은 **하지 않는다**(인증≠소유권 증명, Codex 블로커 E) — 기존 매핑만 사용, 생성은 Slice 4 identify (확인됨: Codex 리뷰)
- HTTP 상태: `provider_error`·예외 → 5xx(RC 재시도), 그 외 → 2xx. **재진입 안전(processed만 duplicate)으로 5xx 재전송이 실패를 올바르게 재처리** (확인됨: Codex 블로커 A)
- `externalId` = `${customerId}:${productId}`(RC v1 실제 단위). 상품 이전·alias 병합은 Slice 5, 소유권 충돌 거부가 가드 (확인됨: Codex 블로커 B)
- 환경: 서버 인스턴스를 단일 환경에 바인딩(운영 production만, sandbox skip) — 포트 불변·스키마 불변 (확인됨: Codex 블로커 C)
- 재시도 실행 루프는 Slice 3로 분리(이 슬라이스는 동기 처리 + 수신함 영속 + 1회 재진입 안전까지) (확인됨: Slice 1 코드 주석·5슬라이스 분할 계획)
