# SDD — RevenueCat 실연결 (서버, #165 Slice 2)

- **관련 PRD**: 0080-revenuecat-webhook-sync/prd.md
- **상태**: draft (Codex 적대적 리뷰 2026-10-15 반영)

## 0. Codex 리뷰 반영 요약
Slice 2 초안을 Codex가 적대적 리뷰(세션 01a13e7c). 블로커 4·중대 7. 아래 설계는 그 지적을 반영한 **수정본**이다. (원 지적·분류는 trace.md.)

## 1. 접근 방식 (Approach)

### 1-1. 재진입 안전(수신함) — Slice 1 서비스 수정 [블로커 A]
현행 `processEvent`는 eventId가 수신함에 있으면 상태 무관 `duplicate`→200. 라이브 재시도에선 **실패(failed)·중단(received) 이벤트의 재전송이 성공처럼 종결**된다. 수정:
- `findUnique` 후 **`status === "processed"` 일 때만 `duplicate`(종결)**. 그 외 상태(received·failed·skipped)는 **재처리**로 진행.
- 신규는 `create(received)`, P2002 레이스는 재조회 후 상태 확인(처리됐으면 duplicate, 아니면 진행).
- 동시 재처리 안전성은 **멱등 upsert(`@@unique(platform,externalId)`) + verifiedAt 펜싱**으로 보장(별도 락 불필요). 스케줄 재시도 루프는 Slice 3지만 **1회 재진입 안전은 이 슬라이스**.

### 1-2. 환경 격리 — 서버 인스턴스 = 단일 환경 [블로커 C/4]
`Subscription`에 environment 컬럼·유니크가 없어 sandbox가 production 행을 덮을 수 있음. 스키마 변경 대신:
- 서비스에 **기대 환경**(`expectedEnvironment`, env `REVENUECAT_ENVIRONMENT` 기본 production) 주입. `evt.environment !== expectedEnvironment` → 수신함에 `skipped("env_mismatch")` 기록 후 종료(2xx). 운영 서버는 production만 반영, sandbox는 별도 배포에서.
- 어댑터도 같은 환경으로 바인딩 → 재조회 시 sandbox면 `X-Is-Sandbox: true`. **포트 시그니처 불변**(환경을 매 호출 인자로 넘기지 않음 → 공유 어댑터 가변필드 레이스 회피). [C 해결]

### 1-3. RevenueCatBillingProvider (REST v1) — [블로커 B·중대 5/6/7]
`BillingProviderPort.getSubscriberState(customerId)` 구현:
- `GET {REVENUECAT_API_BASE}/v1/subscribers/{customerId}`, `Authorization: Bearer <SECRET>`, sandbox 환경이면 `X-Is-Sandbox: true`. **global fetch + AbortController 타임아웃**(`REVENUECAT_HTTP_TIMEOUT_MS`, 기본 8000).
- 2xx 아님·네트워크·타임아웃 → `{ ok:false, errorCode }`. **404도 ok:false**(`customer_not_found`) — "구독 없음"으로 단정해 기존 active를 만료시키지 않음. [중대 7]
- `subscriber.subscriptions`(product_id 맵) 순회로 `ProviderSubscriptionSnapshot[]` 생성:
  - **externalId = `${customerId}:${productId}`** — RC v1의 실제 단위(고객×상품). `original_app_user_id`는 alias로 바뀔 수 있어 사용 안 함. 교차사용자 이전·병합은 Slice 5 보류(소유권 충돌 거부가 가드). [블로커 B]
  - **platform**: `store` app_store→APP_STORE, play_store→PLAY. **그 외(amazon·stripe·promotional 등)는 그 snapshot skip**(TEST로 강제 변환 금지). [중대 5]
  - **period**: `PRODUCT_PERIODS`(productId→MONTHLY|YEARLY) **레지스트리**로 결정. 미등록 productId는 skip(`unknown_product`). 기간 길이 추정 안 함. [중대 5]
  - **status 순서**: `expires_date > now` → active; 아니고 `grace_period_expires_date > now` → grace; 아니면 expired. (active 우선, grace는 만료 후만) [중대 6]
  - **currentPeriodEnd = expires_date**(필수). 없거나 파싱불가면 snapshot skip(`invalid_period_end`). gracePeriodEnd = grace_period_expires_date|null.
  - **grace 결합**: entitlement의 grace는 `product_identifier`로 해당 상품 subscription과 매칭해 보강(불일치는 subscription 기준). [중대 6]
  - **autoRenew = (unsubscribe_detected_at == null)** — best-effort(권한 판정엔 미사용, status/expiry가 기준). 주석 명시.
- 반환된 snapshot만 upsert(현행 유지). **공급자 응답에서 사라진 기존 행의 만료 정리(대사)는 Slice 3**(명시). RC는 취소된 구독도 expired로 유지해 "사라짐"은 드묾.

### 1-4. 웹훅 라우트·인증 — [중대 8/9]
- 부트스트랩 `NestFactory.create(AppModule, { rawBody: true })` → `req.rawBody: Buffer` 보존.
- `RevenueCatWebhookGuard`(핸들러 전 실행): **원본 Buffer 기준** 검증.
  - 정적 `Authorization`: 설정값과 **길이 선검사 후 `crypto.timingSafeEqual`**. **필수설정 미존재면 거부**(빈값끼리 통과 금지).
  - HMAC(시크릿 설정 시): `X-RevenueCat-Webhook-Signature` 파싱 `t=<ts>,v1=<hex>` — 형식(ts 정수·v1 hex) 엄격, **5분 허용오차**, `HMAC_SHA256(secret, "${t}.${rawBodyBuffer}")` 상수시간 비교. rawBody 누락·형식오류·시간차 초과 → 401.
- 컨트롤러 `POST /billing/revenuecat/webhook`(공개, JwtAuthGuard 없음). 인증 통과 후 payload→`IncomingSubscriptionEvent` 매핑: provider=REVENUECAT, projectId=`REVENUECAT_PROJECT_ID`, eventId=`event.id`, type=`event.type`, environment=`event.environment` 소문자, occurredAt=`event.event_timestamp_ms`, customerId=`event.app_user_id`, payload=원 event. **필수 필드(id·app_user_id·environment·timestamp) 없으면 400**(인증 후에도 입력 검증). [중대 9]
- **HTTP 상태 매핑**: `processed`(applied/noop)·`duplicate`·`unmapped`·`skipped` → **2xx**(RC 재시도 멈춤, 재진입-안전으로 재시도 와도 올바르게 재처리). `provider_error`·예외 → **5xx**(RC 재시도 유도) — 재진입 수정(1-1) 덕에 재전송이 failed를 올바르게 재처리. [블로커 A]

### 1-5. 매핑 정책 — lazy 생성 제거 [블로커 E/10]
웹훅 인증 ≠ 소유권 증명. **BillingCustomer 생성은 Slice 2에서 안 한다**(기존 매핑만 조회·사용). 매핑 생성은 **서버가 검증한 계정 연결**(Slice 4 앱 identify). 기존 매핑은 **절대 재할당 금지**. 매핑 없는 이벤트 → `skipped("unmapped_customer")` 2xx, 복구(백필)는 Slice 3 대사.

### 1-6. 설정 바인딩·검증 — [중대 12]
`SubscriptionsModule` useFactory(ConfigService):
- `REVENUECAT_SECRET_KEY` 있으면 운영 활성 → **필수 설정 검증**(`REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_PROJECT_ID` 없으면 부트 throw — 조용한 동기화 불능 금지). RevenuecatBillingProvider 바인딩, env 환경 주입.
- 없으면 기존 `UnconfiguredBillingProvider`(개발 안전). 이때 웹훅 Guard는 Authorization 미설정이므로 **모든 요청 거부**(열린 라우트로 노출 안 됨).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 서버=단일환경 바인딩, sandbox 배제 | 스키마 불변·레이스 없음 | sandbox는 별도 배포 필요 | ✅ |
| Subscription에 environment 컬럼+유니크 | 한 DB 공존 | 스키마·권한계산·마이그레이션 확장(Slice 1 토대) | ❌(Slice 5 재검토) |
| externalId = customerId:productId | RC v1 실제 단위·유니크 안전 | 이전/병합 미지원 | ✅(이전은 Slice 5) |
| externalId = original_app_user_id:productId | — | alias 변동 시 오귀속 | ❌ |
| 선응답 후 비영속 백그라운드 처리 | 빠른 200 | 유실·재진입 불안 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- `packages/db/src/subscription-ops.ts`: 상수 `PRODUCT_PERIODS`·헬퍼(스냅샷 매핑 보조 순수함수: store→platform, status 순서, period 조회) — 순수·테스트 용이.
- `apps/api/src/modules/subscriptions/`:
  - `revenuecat-billing-provider.ts`(신규, 어댑터) + `.spec.ts`
  - `revenuecat-webhook.guard.ts`(신규, 인증) + `.spec.ts`
  - `subscriptions.controller.ts`(신규, 라우트) + `.spec.ts`
  - `subscription-sync.service.ts`(수정: 재진입·환경게이트) + `.spec.ts`(케이스 추가)
  - `subscriptions.module.ts`(수정: useFactory 바인딩·검증·컨트롤러 등록)
  - `billing-provider.port.ts`(불변)
- `apps/api/src/main.ts`(수정: `rawBody: true`).
- `apps/api/test/`: 웹훅 e2e(실 PG+Nest HTTP) + `scripts/db-e2e.sh` 재사용.
- `apps/api/.env.example`(있으면) env 추가. 계약(contracts)·access 응답 불변.

## 4. 데이터 / 계약 (Contracts)
외부로 노출되는 신규 엔드포인트 = 공개 웹훅 `POST /billing/revenuecat/webhook`(RC 전용, 인증 헤더). 앱/클라이언트 계약 변경 없음. `Subscription`/`access` 스키마 불변.

## 5. 위험과 완화 (Risks)
- R1. Nest가 전역 JSON 파싱 → 진짜 "파싱 전 거부" 아님. 완화: `rawBody` Buffer로 HMAC 검증(재직렬화 금지), 라우트 전용 검증, e2e로 바이트 보존 확인. [중대 8]
- R2. 동기 처리 시간 예산. 완화: fetch 타임아웃 + 전체 핸들러 경량(재조회 1회+트랜잭션), ≪60초. 과부하·스케줄 재시도는 Slice 3. [중대 11]
- R3. 매핑 없이 들어온 실제 구독 → unmapped 적체. 완화: Slice 4 identify로 매핑 생성, Slice 3 대사로 백필. 이 슬라이스는 유령 매핑 안 만드는 게 안전. [E]
- R4. 상품 이전·alias 병합 미지원. 완화: (고객×상품) 단위 + 소유권 충돌 거부로 오귀속 차단, 이전은 Slice 5. [B]

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 PR(#165→develop, Slice 2). 운영 활성은 **env 주입 시에만**(키 없으면 Unconfigured+거부). 문제 시 env 제거로 즉시 비활성, 코드 revert. 스키마 변경 없음.

## 7. 검증 (Verification)
- 어댑터 단위: active·grace(만료후)·expired·unknown store skip·unknown product skip·404 ok:false·네트워크 ok:false·빈 subscriptions.
- Guard 단위: 정적 OK/불일치/미설정거부, HMAC OK/위조/형식오류/시간초과/ rawBody 누락.
- 서비스 단위(추가): **failed 후 동일 eventId 재전송 → 재처리 성공**, 중단 received 복구, **sandbox(env_mismatch) skip**, processed만 duplicate.
- e2e(실 PG+Nest HTTP): 공백/개행 포함 원본 JSON의 HMAC 통과, 재전송 멱등, unmapped 2xx, provider_error 5xx, env_mismatch 2xx skip.
- `bash agents/harness/evals/checks.sh` ALL PASS + `bash scripts/db-e2e.sh`.
