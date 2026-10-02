# 0062 — 구독 상태·권한 모델 (TRACE)

- **이슈:** #162

## 2026-10-02

### 착수 · 설계 토론
- TASK-006 전체 설계는 Codex 토론(2026-10-02) → ADR-12 확정. 사용자 결정: 혜택=보관+분석 월 쿼터(50), 결제=IAP+RevenueCat, 월간+연간·보관 무제한.
- 4 슬라이스로 분할(#162 모델·권한 / #163 보관전환 / #164 실삭제 / #165 결제). 이 spec = ①#162.
- 현재 코드 확인(Explore): User에 plan 없음 · Entitlement(freeGranted/Consumed/Reserved)+EntitlementCharge(jobId PK·status) 원장 · 결제 코드 전무.

### 설계 결정(이 슬라이스)
- 구독 쿼터는 **별도 카운터 없이 EntitlementCharge 행 수**로 계산(source=SUBSCRIPTION·window 내 reserved|consumed). 스키마 변화 최소(source 1필드).
- 월 쿼터 윈도우 = **캘린더월(UTC) 리셋**(단순·예측). 타임존 미세조정 후속.
- reserveAnalysis: 구독 쿼터 우선 → 소진 시 무료 폴백 → 둘 다 없으면 거부. 접수 근거(source) 고정.
- 구독 행은 ④가 생성 — 이 슬라이스는 모델·순수 로직·계약만, 구독 경로는 시드 단위 테스트로 검증.
- R1: 구독 쿼터 reserve는 소프트 한도(count-then-insert) — 엄격 원자화는 후속. 무료는 기존 원자성 유지.

### 구현 기록
- 스키마: `Subscription`(platform/period/status·currentPeriodEnd·externalId @@unique·verifiedAt) + `EntitlementCharge.source(ChargeSource @default FREE)` + User.subscriptions. 마이그레이션 SQL은 `prisma migrate diff --from-schema-datamodel(HEAD) --to-schema-datamodel`로 생성해 20261002000000_add_subscription에 기록. 그 뒤 **사용자 승인하에 `prisma migrate reset --force`로 dev DB 전체 재적용·검증**(기존 체크섬 드리프트 해소, 7개 마이그레이션 clean apply, status "up to date" 확인).
- 순수 `subscription-ops.ts`: isEffectivelyActive·canSaveDocuments·monthWindowStart(UTC월)·subscriptionQuotaRemaining·SUBSCRIPTION_MONTHLY_QUOTA=50.
- `entitlement-ops.ts`: reserveAnalysis(구독 쿼터 우선→소진 시 reserveFreeAnalysis 폴백, source 기록)·settleAnalysis(FREE→기존 카운터 / SUBSCRIPTION→charge 상태만, 멱등)·getAnalysisAccess(보관·분석 잔여). 구독 쿼터=charge 행 수(source+window).
- 호출부: documents.repository(reserveFreeAnalysis→reserveAnalysis) · analysis-ops(settleFreeAnalysis→settleAnalysis). 기존 함수는 유지(하위 호환).
- contracts `access.ts`(accessResponseSchema) + api `GET /me/access`(entitlement 컨트롤러·서비스).
- 테스트: `apps/api/.../subscription.spec.ts` — 순수 4 + reserve 5 + settle 5 + access 2. 기존 entitlement-ops.spec 포함 api 28건 PASS. checks.sh ALL PASS.
- R1(구독 쿼터 소프트 한도 count-then-insert) 주석·sdd 기록. 구독 행은 ④가 생성, 이번엔 시드 단위 테스트로 검증.
