# 0027 — 무료 분석 횟수 서버 집행 — SDD

> **관련 PRD**: prd.md · **이슈:** #90

## 1. 접근 (Approach)
무료 횟수를 **예약(reserve) → 확정(consume) | 해제(release)** 2단계 원장으로 집행한다. 예약은 접수 시(한도 집행·동시성 방지), 확정/해제는 terminal 전이와 같은 트랜잭션에서. 멱등키는 `AnalysisJob.id`.

- **데이터 모델** (schema.prisma):
  - `Entitlement`(userId PK): `freeGranted`(기본 3) · `freeConsumed` · `freeReserved`. 가용 = `freeGranted - freeConsumed - freeReserved`.
  - `EntitlementCharge`(jobId PK = 멱등키): `userId` · `status`(reserved→consumed|released) · `settledAt`. 1 job = 최대 1 원장 행.
- **예약 + 한도 집행** (`reserveFreeAnalysis`): 새 job 생성 트랜잭션 안에서 조건부 원자 업데이트
  `UPDATE Entitlement SET freeReserved = freeReserved+1 WHERE userId=? AND (freeGranted-freeConsumed-freeReserved) >= 1` → 영향 0행이면 가용 없음 → 거부. 성공 시 charge(reserved) 생성. 기존 charge 있으면(같은 jobId) 멱등 통과.
- **확정 / 해제** (`settleFreeAnalysis`): `reaggregateAndBump`가 terminal 판정 시 호출. charge가 `reserved`일 때만 작동(멱등 가드):
  - `done` → `freeReserved--`, `freeConsumed++`, charge=consumed.
  - 그 외 종결 → `freeReserved--`, charge=released.
- **배치**: 두 함수는 `packages/db/src/entitlement-ops.ts`(도메인 전이 계약, api·worker 공유). `index.ts`에서 재노출 → `@clause-lens/db/analysis` 경로로 import(기존 `confirmPageAnalysisTx`와 동일).
- **집행 배선**: `createAnalysisJob`(documents.repository) 트랜잭션에 `userId` 전달 + 예약, 가용 없으면 도메인 에러 → `DocumentsService.startAnalysis`가 `QuotaExceeded`로 매핑(403/402 성격).
- **잔량 조회**: `EntitlementModule`(service+controller) — `GET /me/entitlement` → `{ freeGranted, freeRemaining, freeConsumed, freeReserved }`. 최초 조회 시 행 보장(upsert).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 접수 시 즉시 차감 | 단순 | 정책(= terminal·done만) 위반, 실패 시 환불 필요 | ❌ |
| terminal에서만 차감(예약 없음) | 모델 단순 | 동시 접수가 한도 초과(1회 남았는데 2건 done) | ❌ |
| 예약→확정/해제 2단계 원장 | 동시성 안전·정책 정확·멱등 | 모델 1개 추가 | ✅ |
| 멱등을 `freeConsumed` 비교로 | 테이블 1개 | job별 상태 추적 불가·중복 판정 불가 | ❌ → charge 원장 |

## 3. 영향받는 코드 (Touched Surface)
- `packages/db/prisma/schema.prisma` — `Entitlement`·`EntitlementCharge`·`EntitlementChargeStatus` + `User`/`AnalysisJob` 관계. 마이그레이션 SQL.
- `packages/db/src/entitlement-ops.ts`(신규) — `reserveFreeAnalysis`·`settleFreeAnalysis`·`FREE_GRANTED_DEFAULT`·`getEntitlement`.
- `packages/db/src/analysis-ops.ts` — `reaggregateAndBump`에서 `settleFreeAnalysis` 호출(훅 지점 실구현).
- `packages/db/src/index.ts` — entitlement-ops 재노출.
- `apps/api/src/modules/documents/documents.repository.ts` — `createAnalysisJob(documentId, userId, pages)` 예약.
- `apps/api/src/modules/documents/documents.service.ts` — 예약 실패 → `ForbiddenException`(quota) 매핑, userId 전달.
- `apps/api/src/modules/entitlement/*`(신규) — module·service·controller, `GET /me/entitlement`.
- `apps/api/src/app.module.ts` — EntitlementModule 등록.
- `packages/contracts/src/entitlement.ts`(신규)·`index.ts` — `EntitlementResponse` + quota 오류 코드.
- 테스트: `entitlement-ops` 단위(예약/확정/해제/멱등/동시성), service·settle 경계.

## 4. 검증 (Verification)
- **단위**(`entitlement-ops` + `analysis-ops`): 예약 성공/한도 소진 거부 · 멱등 재예약 no-op · `done`→consume 1회 · 비-done→release · settle 중복 호출 no-op · 동시 예약 2건 중 1건만 성공(가용 1).
- **서비스**: `startAnalysis` 가용 없음 → `ForbiddenException`(quota) · 기존 job 재접수는 재예약·재차감 없음.
- **통합**(기존 `documents.service.analysis.spec`·worker `terminalize`): terminal 경로가 settle를 호출하는지 · 잔량 조회가 서버 값 반환.
- **게이트**: `bash agents/harness/evals/checks.sh` PASS(typecheck + 단위 + 이슈·체크박스 기록).

## 5. 리스크 / 롤백
- **동시성**: 예약은 조건부 단일 UPDATE(원자) — 격리수준 무관. 확정/해제는 Serializable `reaggregate` tx 안(기존 재시도 재사용).
- **마이그레이션**: 새 테이블 추가뿐 — 기존 데이터 영향 없음. 기존 사용자 행은 최초 접수/조회 시 upsert로 생성.
- **집행 켜짐**: 예약 실패=거부가 분석 흐름을 막으므로, 기존 사용자(Entitlement 행 없음)도 upsert로 3회 부여 후 정상 통과하는지 테스트로 보장.
