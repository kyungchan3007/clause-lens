# SDD — 앱 구매/복원 + identify 매핑 (#165 Slice 4A, 서버)

- **관련 PRD**: 0083-purchase-identify/prd.md
- **상태**: draft (Codex 리뷰 2026-10-17 + 사용자 범위 결정 = 4A 서버부터)

## 0. 결정 요약
Codex 리뷰(세션 baa9hothz) 블로커 2·중대 다수. 사용자 결정: **4A(서버) 먼저**(앱 SDK·UI·수명주기=4B), 이전 정책 **기존 소유자 유지**.
- 포함(4A): identify 엔드포인트(멱등 매핑 생성·타 소유자 덮어쓰기 금지) + 최초 연결 직후 **재동기화**(매핑 전 도착한 구독 반영) + 소유권/복원 정책 명문화.
- 제외(4B): 앱 RevenueCat SDK·구매/복원 UI·계정 수명주기·구매 후 폴링.
- **정직한 한계(블로커 A)**: appUserID는 클라가 설정하므로 identify는 **내부 매핑 생성만** 안전하게 함 — "구매 소유권 증명"이 아님. 진짜 소유권 증명(서버 영수증 검증 / RevenueCat secure logIn)은 **출시 전 과제**로 기록(이 슬라이스 범위 밖).

## 1. 접근 방식 (Approach)

### 1-1. 모듈 구성 — 신규 `BillingModule`
- `apps/api/src/modules/billing/`: `imports: [AuthModule, SubscriptionsModule]`, `controllers: [BillingController]`, `providers: [BillingIdentifyService]`. AppModule에 등록.
- SubscriptionsModule(잡 CLI도 재사용)에 AuthModule을 끌어들이지 않기 위해 별도 모듈. SubscriptionSyncService는 SubscriptionsModule이 export(기존).

### 1-2. `BillingIdentifyService.identify(userId, now)`
1. **멱등 매핑 확보(타 소유자 덮어쓰기 금지)**:
   - `findUnique(provider=REVENUECAT, customerId=userId)`.
   - 없으면 `create({ userId, provider, customerId: userId })`. P2002(동시 생성)은 `mappingCreated=false`로 무해 처리.
   - 있는데 `userId` 불일치면 `ConflictException`(정상 경로엔 불가 — 방어선). **절대 재할당 안 함.**
2. **최초 연결 직후 재동기화**: `sync.reconcileCustomer(userId, now)` 호출 → 매핑 전 도착해 unmapped로 skip됐던(또는 대사 미도달) 구독을 지금 반영. 공급자 미연결/실패면 provider_error(no-op, 안전).
3. 반환 `{ customerId: userId, mappingCreated, synced: { outcome, applied } }`.

- customerId = **서버가 userId에서 파생**. 클라이언트가 보낸 app_user_id는 **읽지도 않음**(위조 불가).

### 1-3. `BillingController` (`@Controller("me/billing")`, `@UseGuards(JwtAuthGuard)`)
- `POST /me/billing/identify` (`@HttpCode(200)`): `identify(CurrentUser.userId, now)`.
- 멱등이라 "로그인 시 1회"뿐 아니라 "구매 후 재확인(4B)"에도 재사용 가능.

### 1-4. 계약 (`packages/contracts/src/billing.ts`)
- `billingIdentifyResponseSchema = { customerId, mappingCreated, synced:{ outcome: enum(applied|noop|unmapped|provider_error), applied } }`. index에 export.

### 1-5. 소유권·복원 정책(문서) — 블로커 D
- **기존 소유자 유지**(기존 `resolveOwnership`과 일치): 자동 이전 금지. (platform,externalId)가 타 userId면 충돌 → 반영 안 함.
- 복원 충돌 시: 권한 미부여 + 중립 안내(타인 신원 노출 금지) — UI는 4B. 실제 계정 이전은 수동/고객지원(추후).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 별도 BillingModule(Auth+Subscriptions) | 잡 CLI에 Auth 안 끌어옴·관심사 분리 | 모듈 1개 추가 | ✅ |
| SubscriptionsController에 identify 추가 | 파일 적음 | 공개 웹훅과 인증 라우트 혼재·CLI가 Auth 끌어옴 | ❌ |
| identify를 매핑 생성만(재동기화 없음) | 단순 | 매핑 전 구독 영구 누락(unmapped skip 재처리 보장 X) | ❌(Codex E) |
| customerId를 서버 발급 불투명 id | 추측 저감 | SDK ID를 서버만 설정 강제 못 함·4B 수명주기 필요 | ❌(4B·출시전 과제) |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `apps/api/src/modules/billing/{billing.module,billing.controller,billing-identify.service}.ts`(+2 spec)
- `apps/api/src/app.module.ts`(+BillingModule)
- `packages/contracts/src/{billing.ts,index.ts}`
- `apps/api/test/billing-identify.e2e-spec.ts`(서비스 레벨 실 DB)
- 앱·기존 동기화 로직 불변. Subscription/스키마 불변.

## 4. 데이터 / 계약
- 신규 인증 엔드포인트 `POST /me/billing/identify`. 계약 1개 추가. 기존 access/entitlement 불변.

## 5. 위험과 완화
- R1. 매핑 재할당 탈취 → create-only + 불일치 Conflict. 재할당 경로 없음.
- R2. identify 실패 후 구매 → 매핑 없이 webhook unmapped. 완화: 멱등 identify를 **구매 선행조건**(4B)·재시도. 4A는 재동기화로 매핑 생성 시 기존 구독 흡수.
- R3. 소유권 증명 공백(블로커 A) → "내부 매핑만 안전" 명시, 영수증 검증/secure logIn은 **출시 전 과제**(trace·Notion 13 기록).

## 6. 롤아웃 / 되돌리기
- 단일 PR(#165 Slice 4A → develop). 엔드포인트는 인증 필요·멱등. 문제 시 라우트 제거/ revert. 스키마 변경 없음.

## 7. 검증
- 단위: identify(신규 생성·멱등·타 소유자 Conflict·P2002 레이스·재동기화 호출) + 컨트롤러(guard·userId 전달).
- e2e(실 PG, 서비스 레벨): 매핑 영속·멱등·재동기화가 Fake 공급자 구독 반영.
- `bash agents/harness/evals/checks.sh` ALL PASS + `scripts/db-e2e.sh`.
