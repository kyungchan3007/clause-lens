# 0062 — 구독 상태·권한 모델 (SDD)

- **관련 PRD**: 0062-subscription-model/prd.md
- **이슈:** #162
- **상태**: draft
- **설계 근거**: ADR-12(Codex 2026-10-02) · ADR-06(보존·삭제) · ADR 0027(무료 집행 원장).

## 1. 접근 (Approach)
구독 **모델 + 순수 권한/쿼터 로직 + 근거(FREE|SUBSCRIPTION) 원장 + 읽기 API**만. 결제/행 생성은 ④(#165). 구독 행은 이 슬라이스가 쓰지 않으며, 테스트는 시드로 검증.

**① 데이터 모델** (`packages/db/prisma/schema.prisma` + 마이그레이션)
- `Subscription`
  - `id`·`userId`·`platform`(APP_STORE|PLAY|TEST)·`productId`·`period`(MONTHLY|YEARLY)
  - `status`(active|grace|expired)·`externalId`(외부 구독ID)·`currentPeriodEnd`·`autoRenew`·`verifiedAt`·`createdAt`·`updatedAt`
  - `@@index([userId, status])` · `@@unique([platform, externalId])`(계정 간 중복 귀속 방지)
- `EntitlementCharge.source ChargeSource @default(FREE)` 추가 — enum `ChargeSource { FREE SUBSCRIPTION }`. 기존 행은 FREE 기본.
- 보관 권한의 근거 = `Subscription`(status active|grace). 무료 잔액 = 기존 `Entitlement`(불변).

**② 순수 함수** (`packages/db/src/subscription-ops.ts`, 시계 주입·DB 비의존)
- `SUBSCRIPTION_MONTHLY_QUOTA = 50`
- `canSaveDocuments(subs, now)`: status active|grace 구독이 하나라도 있으면 true(보관 권한).
- `analysisSource(subs, now)`: 보관 권한 있으면 `"SUBSCRIPTION"`, 없으면 `"FREE"`(쿼터 소진 시 호출측이 FREE 폴백).
- `monthWindowStart(now)`: 현재 UTC 캘린더월 1일 00:00(월 쿼터 리셋 기준). (타임존 미세조정은 후속 config)
- `subscriptionQuotaRemaining(usedInWindow)`: `max(0, 50 - usedInWindow)`.

**③ 근거 원장·예약·정산** (`packages/db/src/entitlement-ops.ts` 확장)
- `reserveAnalysis(tx, userId, jobId, now)` — 기존 `reserveFreeAnalysis`를 감싸 근거 선택:
  - 같은 jobId charge 있으면 멱등 true.
  - 유효 구독(`canSaveDocuments`)이고 월 쿼터 잔여(window 내 source=SUBSCRIPTION·status in reserved|consumed 건수 < 50)면 → `charge(reserved, source=SUBSCRIPTION)` 생성, true. (Entitlement 카운터 불변 — 구독 쿼터는 charge 행 수로 계산)
  - 아니면 **무료 폴백**: 기존 `reserveFreeAnalysis`(원자적 조건부 UPDATE) + charge.source=FREE.
  - 둘 다 없으면 false(quota 거부).
- `settleAnalysis(tx, jobId, outcome)` — charge.source로 라우팅:
  - FREE → 기존 `settleFreeAnalysis`(done=consume 카운터, 그 외 release).
  - SUBSCRIPTION → charge status만 전이(done=consumed, 그 외=released). Entitlement 카운터 불변(쿼터는 행 수).
- 기존 `reserveFreeAnalysis`/`settleFreeAnalysis`는 유지(하위 호환), 호출부는 `reserveAnalysis`/`settleAnalysis`로 교체.

**④ 권한 조회** (`apps/api` + `packages/contracts`)
- `GET /me/access` → `{ storage: { canSave }, analysis: { source: "subscription"|"free", remaining, monthlyQuota } }`.
  - subscription remaining = `subscriptionQuotaRemaining(window 사용량)`, free remaining = 기존 `freeRemaining`.
  - 기존 `GET /me/entitlement`은 불변(앱 호환).

## 2. 고려한 대안 (Alternatives)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 구독 모델 | User.plan | ❌ | 갱신·환불·복원·복수 이력 표현 불가 |
| | 별도 Subscription | ✅ | ADR-12 |
| 월 쿼터 저장 | Entitlement에 월 카운터 | ❌ | 월 리셋·기간 관리 복잡 |
| | charge 행 수로 계산(source+window) | ✅ | 스키마 변화 최소(source 1필드), 원장이 곧 진실 |
| 쿼터 윈도우 | 구독 기간 기준 | ❌ | 연간 구독의 "월 쿼터" 표현 복잡 |
| | 캘린더월(UTC) 리셋 | ✅ | 단순·예측가능. 타임존은 후속 |
| 읽기 API | entitlement 확장 | ❌ | 기존 계약 결합·앱 호환 깨짐 우려 |
| | 신규 GET /me/access | ✅ | 분리·앱 변경 없이 계약 추가 |

## 3. 영향받는 코드 (Touched Surface)
- `packages/db/prisma/schema.prisma`(+마이그레이션): Subscription·enums·EntitlementCharge.source.
- `packages/db/src/subscription-ops.ts`(신규, 순수) + 테스트.
- `packages/db/src/entitlement-ops.ts`(reserveAnalysis·settleAnalysis) + 테스트.
- 호출부: 분석 접수(`apps/api .../documents.repository.ts` reserveFreeAnalysis→reserveAnalysis)·정산(`packages/db/src/analysis-ops.ts` settleFreeAnalysis→settleAnalysis).
- `apps/api` access 컨트롤러/서비스 + `packages/contracts/src/access.ts`(신규) + index.
- 앱 변경 없음.

## 4. 데이터 / 계약 (Contracts)
- `accessResponseSchema`: `{ storage:{canSave:boolean}, analysis:{ source:"subscription"|"free", remaining:number, monthlyQuota:number } }`.
- `EntitlementCharge.source` 기본 FREE(기존 행 안전). settle 멱등 유지.

## 5. 위험과 완화 (Risks)
- R1 구독 쿼터 reserve 동시성(카운터 아닌 count-then-insert) → 소프트 한도라 고동시에서 수건 초과 가능. 완화: 월 쿼터는 소프트 제한으로 수용, 엄격화는 후속(카운터/어드바이저리 락). 무료 경로는 기존 원자성 유지.
- R2 접수 후 실행 중 구독 만료 → 근거(source) 고정이라 무료로 바뀌지 않음(ADR-12). settle은 접수 근거대로.
- R3 구독 행 미존재(④ 전) → reserveAnalysis는 항상 FREE 경로(동작 불변). 구독 경로는 시드 단위 테스트로 검증.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 마이그레이션(Subscription·source) + 코드. 되돌리려면 호출부를 reserveFreeAnalysis/settleFreeAnalysis로 복귀 + 마이그레이션 revert(source 기본 FREE라 데이터 안전).

## 7. 검증 (Verification)
- 단위:
  - subscription-ops: canSaveDocuments(active/grace/expired)·analysisSource·monthWindowStart(월 경계)·subscriptionQuotaRemaining.
  - entitlement-ops: reserveAnalysis(구독 쿼터 선점·소진 시 무료 폴백·멱등)·settleAnalysis(source별 정산·멱등).
- 통합: `bash agents/harness/evals/checks.sh` ALL PASS(prisma validate·api/worker/db 단위 포함).
