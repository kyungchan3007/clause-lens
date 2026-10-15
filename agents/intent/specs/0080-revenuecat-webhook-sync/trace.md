# TRACE — RevenueCat 실연결 (서버, #165 Slice 2)

- 2026-10-15 착수. #165 5슬라이스 중 Slice 2(실연결). 선행 Slice 1(0079) develop 머지(PR#200, eda08ac). 브랜치 `feat/165-revenuecat-webhook`(이슈에서 생성, base=develop+Slice1).
- 공식 문서 사실 확인(2026-10-15):
  - 웹훅 인증 2겹 = 정적 `Authorization` 헤더(옵션·상수시간) + 선택 HMAC `X-RevenueCat-Webhook-Signature: t=<ts>,v1=<hex>` (`${t}.${rawBody}` SHA256, 5분 허용·raw body 파싱 전 검증). RC 60초 내 2xx 없으면 끊고 비2xx면 재시도.
  - 재조회 v1 `GET /subscribers/{app_user_id}` Bearer secret, `subscriber.subscriptions`(product_id 맵)·`entitlements`(expires_date·grace_period_expires_date), 활성 직접 계산, 샌드박스 `X-Is-Sandbox:true`.
  - → Slice 1에서 Codex가 세운 설계(웹훅=재조회 트리거, HMAC+Authorization)와 정확히 일치.
- 설계 규칙(codex-design-discussion-first): Slice 2 설계안을 Codex에 적대적 리뷰 의뢰(background, scratchpad/codex-slice2-design.md). 논점 A~F: HTTP 상태↔RC 재시도↔수신함 멱등, externalId 계보, 샌드박스 환경 전달, Nest rawBody/HMAC 함정, lazy 매핑↔소유권, 동기 처리 60초. **리뷰 결과 반영 후 sdd 확정·구현 착수.**

- **Codex 리뷰 결과(세션 01a13e7c) 반영**: 블로커 4·중대 7.
  - [블로커 A] 재진입 버그 — eventId 있으면 상태 무관 duplicate → 실패가 성공처럼 종결. **processed만 duplicate, 그 외 재처리**로 수정(Slice 1 서비스 변경). 멱등 upsert+펜싱으로 동시성 안전.
  - [블로커 B] externalId=original_app_user_id:productId는 계보 아님(alias 변동) → **(customerId×productId)** 단위로 확정, 이전/병합 Slice 5.
  - [블로커 C] 환경 격리 — Subscription에 environment 없어 sandbox가 production 덮음 → **서버=단일환경 바인딩**(운영 production만, sandbox skip), 포트 불변·스키마 불변.
  - [블로커 E] lazy 매핑 — 웹훅 인증≠소유권 → **매핑 생성 제거**(기존만, 생성은 Slice 4).
  - [중대] period 레지스트리(추정 금지)·unknown store/product skip·status active→grace→expired·404/네트워크 ok:false·HMAC raw Buffer·형식/5분 엄격·필수설정 미존재 거부·처리 시간예산·회귀 테스트(재전송 성공·중단 복구·sandbox skip·빈 조회).
  - 반영본 = sdd.md 최종. 원 지적 전문: scratchpad/codex-slice2-out.txt.
- **설계 노션 기록**(2026-10-15): 백엔드(NestJS) 설계 DB에 "구독 결제 실연결 (RevenueCat 웹훅·REST, Slice 2)" 행 추가(3fadeddc-12a7-818c-9bdb-f884f61755ba).

- **구현 완료(2026-10-15)**:
  - db 순수함수 `storeToPlatform`·`deriveSubscriptionStatus`(active→grace→expired 순서) 추가.
  - `RevenueCatBillingProvider`(v1 GET subscribers, Bearer+X-Is-Sandbox, global fetch+AbortController, store→platform/레지스트리 period/상태순서/externalId=customerId:productId, 404·네트워크 ok:false).
  - `RevenueCatWebhookGuard`(정적 Authorization 상수시간·미설정 거부 + 선택 HMAC `t.body` raw Buffer·형식·5분) + 순수헬퍼 export.
  - `SubscriptionsController` `POST /billing/revenuecat/webhook`(공개·@HttpCode 200, provider_error→503, 입력검증 400).
  - `subscription-sync.service` 수정: **재진입(processed만 duplicate, 그 외 재처리)** + **환경 게이트**(expectedEnvironment 주입, mismatch→skipped) + outcome "skipped" 추가.
  - `subscriptions.module` useFactory 바인딩(키 있으면 실 어댑터+필수설정 검증, 없으면 Unconfigured) + 토큰(ENV·WEBHOOK_CONFIG·PROJECT_ID) + 컨트롤러·가드 등록. `main.ts` rawBody:true. `.env.example` RC 섹션.
- **테스트**: 단위 — 어댑터 9·가드(순수 2 + 정적 3 + HMAC 5)·서비스 재작성(재진입·env skip·processed만 duplicate 등 11). api 51 통과. e2e — 웹훅 HTTP(실 PG+Nest, HMAC 바이트검증·멱등·unmapped·sandbox skip·provider_error 503·bad auth 401) 7 + 기존 4 = 11 통과.
  - 기존 `subscription-sync.e2e-spec.ts`가 모듈 단독 임포트라 ConfigService DI 실패 → `ConfigModule.forRoot({isGlobal})` 추가로 수정.
- **게이트**: `checks.sh` ALL PASS + `scripts/db-e2e.sh` 통과(임시 PG 5433).
- 설계 노션(백엔드 설계 DB) 기록은 착수 시 완료. 완료 기록(01·주차로그·JOURNAL·PR)은 RECORD 단계.
