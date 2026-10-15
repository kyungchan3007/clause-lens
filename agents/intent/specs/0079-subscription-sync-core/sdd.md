# SDD — 구독 동기화 핵심 (서버, #165 Slice 1)

- **관련 PRD**: 0079-subscription-sync-core/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)

### 스키마 (packages/db/prisma/schema.prisma + 수기 마이그레이션)
- `Subscription`에 `gracePeriodEnd DateTime? @db.Timestamptz(3)` 추가.
- `enum BillingProvider { REVENUECAT }`.
- `enum SubscriptionEventStatus { received processing processed failed skipped }`.
- `model SubscriptionEvent`(수신함): id, provider, projectId, eventId, type, environment, occurredAt, receivedAt(default now), status(default received), attempts(default 0), nextRetryAt?, errorCode?, payload Json, processedAt?. `@@unique([provider, projectId, eventId])`, `@@index([status, nextRetryAt])`.
- `model BillingCustomer`(고객 매핑): id, userId(FK User cascade), provider, customerId, createdAt. `@@unique([provider, customerId])`, `@@index([userId])`. User에 `billingCustomers BillingCustomer[]` 추가.
- 마이그레이션: `migrations/20261015000000_add_subscription_sync/migration.sql` 수기 작성(ALTER + CreateEnum + CreateTable + Index + FK).

### 순수 도메인 (packages/db/src/subscription-ops.ts)
- `SubscriptionLike`에 `gracePeriodEnd?: Date | null`. `isEffectivelyActive`: active=기간 남음, grace=`gracePeriodEnd != null && gracePeriodEnd > now`, expired=무효. (기존 #162 grace 테스트 갱신)
- `ProviderSubscriptionSnapshot` 타입(재조회 결과): platform·productId·period·externalId·status(active|grace|expired)·currentPeriodEnd·gracePeriodEnd·autoRenew·environment.
- `normalizeProviderSnapshot(snapshot, now)`: 스냅샷 → Subscription 쓰기 필드(검증된 현재 상태 투영). 과거 기한·만료 반영, 상품 변경은 발효분만.
- `resolveOwnership(existing: { userId } | null, incomingUserId)`: `"ok"`(신규/동일) | `"conflict"`(타 userId). 자동 이관·병합 금지.
- `isStaleWrite(existing: { verifiedAt } | null, queryStartedAt)`: 기존 verifiedAt가 조회 시작보다 **이후**면 true(이미 더 최신 반영 → skip). 펜싱.

### 서비스 (apps/api/src/modules/subscriptions)
- `BillingProviderPort`(인터페이스): `getSubscriberState(customerId): Promise<ProviderSnapshotResult>` — 성공 스냅샷 | 실패. (listPlans/purchase 등 앱 포트는 Slice 4)
- `FakeBillingProvider`(테스트용): 주입된 스냅샷/실패 반환.
- `SubscriptionSyncService`: 이벤트 1건 처리 — 수신함 멱등 저장(중복=no-op) → 고객 매핑으로 userId 해석 → 포트 재조회(실패면 기존 기한만 인정·verifiedAt 미갱신) → `resolveOwnership`(충돌이면 거부·충돌 기록) → `isStaleWrite`(stale이면 skip) → `normalizeProviderSnapshot`로 upsert → 이벤트 processed. Prisma·포트·시계 주입(테스트는 Fake tx).
- 모듈 등록만(controller/route 없음 = 운영 비활성).

### 테스트
- db: subscription.spec.ts 확장(gracePeriodEnd·normalize·resolveOwnership·isStaleWrite).
- api: subscription-sync.service.spec.ts — Fake 포트/prisma/시계로 6케이스(중복·과거 늦게·stale·충돌·유예만료·공급자장애).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 웹훅=재조회 트리거 + 수신함 | 환불·역순·상품변경 단순, 멱등·감사 | 조회 1회 추가 | ✅ (Codex) |
| 이벤트만으로 전이표 대입 | 조회 無 | 역순·환불·부분정보에 취약 | ❌ |
| grace 무기한(현행) | 코드 無 | 알림 누락 시 영구 권한(버그) | ❌ |
| 전체 이벤트 소싱 | 완전 이력 | 과설계 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- `packages/db`: schema.prisma(+모델/필드)·migrations(신규)·src/subscription-ops.ts(+필드·순수함수).
- `apps/api/src/modules/subscriptions/*`(신규: module·port·fake·sync.service·spec), app.module 등록.
- `apps/api/src/modules/entitlement/subscription.spec.ts`(grace 테스트 갱신 — 같은 파일이 db 순수함수도 검증).
- 계약(contracts) 변경 없음(이 슬라이스). access 응답 불변.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 변경 없음. 내부 타입 `ProviderSubscriptionSnapshot`만 추가. 웹훅/ sync API는 Slice 2.

## 5. 위험과 완화 (Risks)
- R1. grace 판정 변경이 #162 테스트 깨뜨림 → 완화: 해당 테스트를 `gracePeriodEnd` 반영해 갱신(의도된 버그 수정, trace 기록).
- R2. 마이그레이션 수기 SQL 오류 → 완화: 기존 add_subscription 패턴 그대로, `prisma validate` + generate + 타입체크 게이트. 로컬 DB 적용은 운영자.
- R3. 동시성(실 DB lease/fencing)은 모킹으로 완전 검증 불가 → 완화: 펜싱 규칙은 순수함수로 테스트, 실 DB 동시성은 Slice 3 통합 게이트로 남김(스펙 명시).

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 PR(#165→develop, Slice 1). 운영 경로 비활성이라 노출 영향 없음. 문제 시 revert(마이그레이션은 후속 되돌림 SQL).

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` ALL PASS(특히 Prisma validate, Typecheck api·db, Unit tests api·db).
- 핵심 6케이스 그린 + grace 만료 케이스.
