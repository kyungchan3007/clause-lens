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
- **후속(실측)**: 실 Postgres 동시 접수 원자성·terminal→settle 통합 실측은 DB/인프라 기동 후. 지금은 로직·오케스트레이션 단위 + 설계(단일 조건부 UPDATE)로 보장.
- **되돌림 없음** — 설계대로 진행.
