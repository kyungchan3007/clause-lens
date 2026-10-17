# SDD — 대사·재시도·운영 알림 (서버, #165 Slice 3)

- **관련 PRD**: 0081-subscription-reconcile/prd.md
- **상태**: draft (Codex 적대적 리뷰 2026-10-15 반영 + 사용자 범위 결정)

## 0. 결정 요약 (Codex 리뷰 + 사용자)
Codex 리뷰(세션 bal47jjra) 블로커 4. 사용자 결정: **(Q1) A — 사라진 구독 만료는 보류**(Slice 1 스키마 확장·완전스냅샷 보장 필요 → 별도 슬라이스), **(Q2) claim 수정은 Slice 3**(Slice 2 PR 미건드림). 따라서 범위:
- 포함: 원자 이벤트 claim+lease(동시성 버그 수정), stored dead-letter, 백오프 재시도 CLI, 대사 CLI(재조회·보정만).
- 제외(후속): 드리프트 "사라진 구독 expired" 강등, 그에 필요한 Subscription environment/provider/customer 컬럼·포트 완전스냅샷 보장.

## 1. 접근 방식 (Approach)

### 1-1. 스키마 (최소 변경) — migration `20261015010000_add_subscription_event_lease_dead`
- `enum SubscriptionEventStatus`에 **`dead`** 추가(저장된 영구 종료 상태 — MAX에 종속되지 않음). [Codex C/6]
- `SubscriptionEvent`에 **`leaseExpiresAt DateTime? @db.Timestamptz(3)`** 추가(claim lease 토큰 겸 만료). `@@index([status, leaseExpiresAt])`.
- 수기 SQL: `ALTER TYPE ... ADD VALUE 'dead'`(값 추가만 — 같은 tx에서 사용 안 하므로 PG17 안전) + `ALTER TABLE ADD COLUMN` + `CREATE INDEX`.
- Subscription 스키마는 **불변**(만료 강등 보류).

### 1-2. 이벤트 원자 claim + lease — processEvent 재구성 [블로커 A, 중대 2]
웹훅·재시도가 공유하는 단일 처리 경로. "성공이 실패로 되돌아가는" 레이스 제거.
- **종결 검사**: findUnique 후 `status ∈ {processed, dead}`면 `duplicate`(재처리 금지).
- **원자 claim**: `updateMany({ where: { id, OR: [ {status: {in:[received,failed]}}, {status: processing, leaseExpiresAt: {lt: now}} ] }, data: { status: processing, leaseExpiresAt: now+LEASE, attempts: {increment:1} } })`. `count !== 1` → 다른 처리자 보유 중 → `duplicate`(no-op). (신규는 create(received) 후 claim; P2002는 refetch→종결이면 duplicate.)
- **lease 토큰**: 우리가 세팅한 `leaseExpiresAt` 값을 토큰으로 보관. 모든 완료 쓰기는 `where: { id, status: processing, leaseExpiresAt: <우리 토큰> }` 조건부 → 만료되어 남이 재획득했으면 우리 완료는 0행(no-op). → **성공 역행·중복 완료 불가**. [블로커 A]
- **완료 경로(공통, 잡은 쓰기 안 함)** [중대 2]:
  - 성공: status=processed, processedAt=now, errorCode=null, nextRetryAt=null, leaseExpiresAt=null.
  - 재시도 실패: attempts<MAX → status=failed, errorCode, **nextRetryAt=now+backoff(attempts)**, lease=null. attempts≥MAX → **status=dead**, nextRetryAt=null.
  - skipped(env_mismatch·unmapped_customer): status=skipped, nextRetryAt=null, lease=null(재시도 큐 제외).
- **attempts/nextRetryAt은 processEvent만 기록**. 재시도 잡은 선택+호출만. [중대 2/A·E]

### 1-3. 실패 분류·백오프 [중대 7]
- 재시도 가능: `provider_error`(일시)·예외. → 백오프.
- 종결(즉시): 복원 불가 payload(복원 실패) → dead. 소유권 충돌은 이벤트가 아니라 snapshot 단위(건너뜀) — 이벤트는 applied/noop로 성공 처리.
- 미매핑/환경불일치: skipped(재시도 안 함, 복구는 매핑 생성=Slice 4 후 신규 이벤트/대사).
- 백오프: **`min(24h, 5m × 2^(attempts-1))` + jitter(±20%)**. MAX=8.

### 1-4. 재시도 잡 (CLI `subscription-retry.ts` + `SubscriptionRetryService`)
- 선택: `status ∈ {received, failed} AND (nextRetryAt == null OR nextRetryAt <= now) AND attempts < MAX`, **+ 유실 processing 회수**는 claim의 OR 조건이 담당. 정렬 `nextRetryAt asc nulls first, id asc`(tie-breaker), `take limit`. [중대 8]
- 각 후보 → `processEvent` 재호출(payload로 IncomingSubscriptionEvent 복원: provider/projectId/eventId/type/environment/occurredAt/customerId는 행에서, payload는 저장분). claim이 실패하면(남이 집음) skip.
- 캡: limit(기본 100) + maxCandidates(기본 500 초과 시 중단) + 실행시간 상한. dry-run 기본(**쓰기·claim·attempts 변경 전혀 없음** — 후보 수·목록만) / `--execute` / kill-switch `SUBSCRIPTION_JOBS_DISABLED`.

### 1-5. 대사 잡 (CLI `subscription-reconcile.ts` + `SubscriptionReconcileService`)
- `BillingCustomer`를 **안정 커서**(orderBy `createdAt asc, id asc`, `--after <id>` 재개)로 batch 순회. [중대 8]
- 각 고객 → `SubscriptionSyncService.reconcileCustomer(provider, customerId, now)`:
  - mapping 조회 → `getSubscriberState` → **ok:false면 skip(만료·강등 없음)** → ok:true면 `applySnapshots`(소유권/stale 펜싱/normalize upsert, processEvent와 **공유 트랜잭션 본문**).
  - **사라진 구독 expired 강등은 안 함**(보류). 커서·cap만.
- 캡: customers limit + maxCustomers + 실행시간. dry-run 기본(읽기 전용) / `--execute` / kill-switch.

### 1-6. 공유 리팩터
- processEvent의 `$transaction { for snap: ownership/stale/normalize/upsert }` 본문을 private `applySnapshots(tx, userId, snapshots, now, queryStartedAt)`로 추출 → processEvent·reconcileCustomer 공용.
- claim/complete 헬퍼도 서비스 private. LEASE·MAX·backoff 상수 export(테스트).

### 1-7. 운영잡 공통 가드 (retention-sweep 패턴) [중대 10, 경미 11]
- 전용 **CLI 모듈**(`SubscriptionJobsCliModule`, AppModule 비포함) — 잡 서비스는 런타임 주입 불가.
- **setInterval·부트훅·HTTP 금지**. dry-run 기본·`--execute`·kill-switch env·batch limit+cap, 두 잡 공통.
- 리포트: retried/succeeded/failed/deadLettered(**이번 신규 + 누적**)·reconciled·skipped·backlog 잔여. 임계(deadLetter>0 등) warn 로그. 능동 알림 인프라는 범위 밖.

## 2. 고려한 대안
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 원자 claim + lease 토큰 조건부 완료 | 성공 역행·중복 완료 불가·크래시 회수 | 로직 복잡 | ✅ |
| processed 검사만(Slice 2) | 단순 | 동시 웹훅·잡에서 성공 역행 | ❌(버그) |
| dead = status 저장값 | MAX 비종속·관측·웹훅 재전송도 종결 | enum 마이그레이션 | ✅ |
| dead = attempts≥MAX 파생 | 무스키마 | MAX 변경 시 부활·재전송 우회 | ❌ |
| 대사 사라진 구독 expired(지금) | 드리프트 완전 | 스키마 확장·완전스냅샷 보장·오만료 위험 | ❌(보류, 사용자 A) |

## 3. 영향받는 코드
- `packages/db/prisma/schema.prisma`(enum `dead`·`leaseExpiresAt`·인덱스) + migration(신규 수기 SQL).
- `apps/api/src/modules/subscriptions/subscription-sync.service.ts`(claim/lease/complete·applySnapshots·reconcileCustomer·backoff) + spec 갱신.
- 신규: `subscription-retry.service.ts`(+spec)·`subscription-reconcile.service.ts`(+spec)·`subscription-jobs-cli.module.ts`·`src/scripts/subscription-retry.ts`·`src/scripts/subscription-reconcile.ts`.
- `apps/api/test/`: 재시도·대사 e2e(실 PG, 순서 제어로 레이스 포함). `.env.example`(SUBSCRIPTION_JOBS_DISABLED 등). AppModule 불변(잡 모듈 미포함).

## 4. 데이터 / 계약
외부 계약·엔드포인트 변화 없음(잡은 CLI). `access` 불변. 내부: SubscriptionEvent +dead/+leaseExpiresAt.

## 5. 위험과 완화
- R1. enum ADD VALUE 트랜잭션 — PG17에서 값 추가만(미사용) 안전. migrate deploy로 검증. [db-e2e]
- R2. lease 토큰 충돌(동일 ms) — leaseExpiresAt 정밀도 + 조건부 완료로 사실상 배제. 필요시 랜덤 토큰 컬럼은 후속.
- R3. dry-run이 상태를 바꾸지 않음 — claim/attempts/schedule 쓰기 전면 금지(읽기 전용 경로 분리). [중대 10]
- R4. 미매핑·사라진 구독 복구는 이 슬라이스 밖 — 문서화(Slice 4 identify·후속 드리프트). [블로커 B 보류]

## 6. 롤아웃 / 되돌리기
스택 PR(#165, base=feat/165-revenuecat-webhook → Slice 2 머지 후 develop 재타겟). 잡은 크론 등록 시에만 작동(기본 미등록). 문제 시 kill-switch·크론 해제. 마이그레이션은 되돌림 SQL 동반 가능(컬럼/enum).

## 7. 검증
- 단위: 재시도(선택·백오프·MAX→dead·received 복구·claim 실패 skip)·대사(ok:false skip·소유권·stale·커서)·서비스(claim 조건부 완료로 성공 역행 없음·dead 종결·skipped 비재시도).
- e2e(실 PG, 순서 제어): 실패 이벤트→재시도 processed·성공/실패 교차에 역행 없음·MAX→dead·lease 만료 회수·dry-run 무변경.
- `bash agents/harness/evals/checks.sh` ALL PASS + `scripts/db-e2e.sh`.
