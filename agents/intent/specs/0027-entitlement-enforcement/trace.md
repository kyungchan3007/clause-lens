# 0027 — 과정 기록 (trace)

## 판단
- **차감 훅 지점**: `packages/db/src/analysis-ops.ts` `reaggregateAndBump`의 `allTerminal` 분기 — 기존 주석("무료횟수 차감 훅 지점")이 가리키던 자리. 전이와 같은 tx라 원자성·멱등 보장에 최적.
- **예약을 둔 이유**: 정책이 "done만 terminal에서 차감"이라, 접수 시 차감하지 않으면 1회 남은 사용자가 2건을 동시에 접수→둘 다 done→2회 차감(음수)된다. 접수 시 원자 예약으로 가용을 선점해 동시성 초과를 막고, terminal에서 확정/해제한다.
- **조건부 UPDATE로 원자 예약**: Prisma `updateMany` where로 `freeGranted-freeConsumed-freeReserved>=1` 계산식 불가 → `$executeRaw` 조건부 UPDATE(영향 행 수로 성공 판정). 격리수준 무관하게 원자적.
- **멱등 원장(EntitlementCharge, jobId PK)**: 재연결·중복 완료 이벤트에 job당 1행. `settleFreeAnalysis`는 `status==reserved`일 때만 작동 → 중복 호출 no-op.
- **배치**: 도메인 전이 계약이므로 `packages/db`(api·worker 공유). worker가 terminal을 만들 때도 같은 함수로 차감.

## 막힘 / 되돌림
- **guard 차단 → SDD 보완**: `packages/db/prisma/schema.prisma` 첫 편집이 guard(#84)에 막힘 — SDD에 "검증" 키워드 필요(`SDD_KEYWORDS=[접근,대안,검증]`). SDD에 `## 4. 검증` 섹션 추가 후 통과.
- **`@clause-lens/db/analysis` 해석**: exports map 없음 → db `tsconfig.outDir=./analysis` 빌드 산출물로 해석. 새 `entitlement-ops.ts`는 `index.ts` 재노출 + db 빌드 후 api·worker에서 import 가능. 편집 때마다 `pnpm --filter @clause-lens/db build` 선행.
- **마이그레이션 수기 작성**: 로컬 Postgres 미기동 → `prisma migrate dev` 대신 기존 형식대로 `migration.sql` 수기 작성(부분 유니크 인덱스도 수기로 추가해온 관례와 일치). 스키마는 더미 URL로 `prisma validate` 통과.
- **단위 테스트 위치**: packages/db엔 테스트 러너 없음 → jest가 도는 api에 `entitlement-ops.spec.ts`. 가짜 tx로 오케스트레이션·멱등·한도 검증.
- **되돌림 없음(초안)** — 설계대로 진행.

## 코덱스 설계 토론 + 실 Postgres 실측 (2026-10-01)
착수 전 토론을 못 해 사후에 Codex와 설계 토론(`codex exec`). 로컬 Postgres 기동 → 통합 테스트 `packages/db/test/entitlement.integration.mjs`(13/13 PASS)로 증거를 대고, Codex 적대 리뷰 + PR #91 AI 리뷰 봇(P1 3건)을 교차 검토해 **보완 4건 합의·적용**:

1. **settle 멱등 계약이 거짓(실측 consumed=2)** — settle을 직접 동시 호출하면 findUnique+update가 둘 다 reserved를 읽어 이중 차감(실측). → `settleFreeAnalysis`를 **원자적 조건부 전이**(`UPDATE EntitlementCharge SET status=target WHERE jobId=? AND status='reserved' RETURNING userId`)로. 반환 행이 있을 때만 카운터 변경 → 격리수준·호출자 무관 1회. (내 관측 + Codex "반드시 바꿀 것" 합의) → T6 검증(consumed=1).
2. **terminal 후 재분석 경쟁(2차 job→2차 차감)** — 활성 유니크 인덱스는 queued|processing만 막아, 1차가 terminal까지 끝나면 지연된 2차 접수가 새 job 생성 가능(P2002로 안 잡힘). → `createAnalysisJob`에 **문서 행 `FOR UPDATE` 잠금 + 기존 job 재확인**으로 문서당 1 job 보장. (Codex 발견, 내가 놓침) → T7 검증(job 1·charge 1).
3. **무결성 CHECK** — `Entitlement`에 `freeConsumed>=0 AND freeReserved>=0 AND freeConsumed+freeReserved<=freeGranted` CHECK(마이그레이션). 원장↔카운터 드리프트를 DB가 거부 → 음수·초과 거부 실측.
4. **주석 과장 교정** — reserve "격리수준 무관" → 정확히(초과 예약 차단, 높은 격리수준에선 직렬화 실패로 나타날 수 있음).

**합의로 현행 유지**: job.create→reserve 순서(동일 tx 롤백 안전), 조건부 예약 UPDATE의 READ COMMITTED 정확성, 원장+카운터 같은 tx 비정규화.
**후속 [보완]**: job 삭제 경로 생기면 카운터 보정(현재 삭제 경로 없음) · 구독 접수 승인 근거 기록(TASK-006) · 방치된 예약은 terminalize가 결국 release.
**하네스 결함**: `trace.auto.jsonl`이 spec 폴더에 있어 브랜치 전환 시 타 브랜치 폴더 게이트를 오탐(0027·0028 모두 겪음) → 위치 이동/비추적 폴더 무시 필요(별도 하네스 이슈).
