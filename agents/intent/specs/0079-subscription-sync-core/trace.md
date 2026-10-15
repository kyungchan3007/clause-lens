# TRACE — 구독 동기화 핵심 (서버, #165 Slice 1)

- 2026-10-15 착수. #165(인앱결제) 큰 기능 → Codex 설계 토론(session 01a13e33) 후 5슬라이스로 분할. 이 spec = Slice 1(서버 동기화 핵심, 계정 없이 모킹).
- Codex 핵심 권고 채택: RevenueCat 웹훅 중심·**웹훅=재조회 트리거**, `SubscriptionEvent` 수신함(멱등 `(provider,projectId,eventId)`), 상태=검증된 현재 상태의 투영, 고객별 직렬화+verifiedAt 펜싱(이벤트 타임스탬프로 순서 보장 금지), 소유권 변경 거부+충돌 기록(자동 이관 금지), HMAC+Authorization(Slice 2), 앱 포트는 구매상태↔권한 분리(Slice 4).
- **토대 버그 수정**: 현행 `subscription-ops`의 grace가 무기한 유효 → `gracePeriodEnd` 추가해 제한. #162 테스트(grace 무기한 가정) 갱신 필요 — 의도된 수정.
- 소유권 정책: "Keep with original App User ID"(귀속 변경 거부). 사용자 ㄱㄱ로 이 방향 확정.
- 운영 웹훅 라우트는 이 슬라이스에서 **비활성**(서비스만, route 없음). 실연결·대사·앱·샌드박스는 Slice 2~5.

- 구현 완료(2026-10-15): 스키마 gracePeriodEnd + SubscriptionEvent·BillingCustomer 모델 + 수기 마이그레이션. subscription-ops에 normalizeProviderSnapshot·resolveOwnership·isStaleWrite + grace 제한(isEffectivelyActive). entitlement-ops loadActiveSubs select에 gracePeriodEnd 추가. api subscriptions 모듈(BillingProviderPort·UnconfiguredBillingProvider·SubscriptionSyncService) + app.module 등록(운영 라우트 없음=비활성).
- 테스트: subscription.spec(#162 grace 테스트 gracePeriodEnd로 갱신 + 순수 normalize/ownership/stale) + subscription-sync.service.spec(Fake prisma/provider, 7케이스: 중복·unmapped·provider_error·applied·conflict·stale·grace만료). api 28 통과. checks.sh ALL PASS.

- e2e(상시 규칙): HTTP 웹훅 라우트가 없는 슬라이스라, 통합 e2e로 **실 Postgres + Nest 모듈 부팅 + 실 Prisma** 검증. 로컬 5432는 타 프로젝트(dayro-postgres) 점유 → 격리 임시 컨테이너(5433)로 `scripts/db-e2e.sh`(기동→migrate deploy→test:e2e→trap 정리). 수기 마이그레이션 SQL 실적용 성공. e2e 4케이스(active 영속·멱등 중복·유예만료 expired 투영·공급자장애 유지) 통과. jest-e2e.json은 rootDir=test라 기본 유닛(rootDir=src)·게이트와 분리(게이트 DB-free 유지).
