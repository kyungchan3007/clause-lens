# SDD — 보관 만료 실삭제 잡 (DB + S3)

- **관련 PRD**: 0069-retention-hard-delete/prd.md
- **이슈:** #164 · **의존:** #163 · **설계 근거**: ADR-12 · ADR-06 · 적대적 리뷰(2026-10-09, 코드 대조)
- **상태**: approved (리뷰 Q1~Q7 반영 · 범위 사용자 확정)

## 1. 접근 방식 (Approach)
보관 만료 **무료(TEMPORARY)** 문서만 물리 삭제한다. 랜덤 UUID finalKey는 DB에만 있으므로 **DB 참조 제거 전 S3 키를 열거**, 크래시 복구 위해 **DELETING 영속**, S3 전부 삭제 확인 후에만 행 삭제. dry-run 기본·사람이 실행하는 standalone 스크립트.

> **범위 확정(사용자, 2026-10-09):** SAVED(구독 만료) 실삭제는 **#165로 연기**. 사유: #165 전엔 구독 생성 코드가 없어 SAVED 문서가 존재하지 않고(테스트 불가), 유예 앵커(`lapsedAt`)가 없어 추정이 "영원히 안 지움/유예 0일" 버그를 내며, 구독 스냅샷→CAS 사이 재구독 TOCTOU로 결제 중 문서를 지울 수 있다. #164는 구독 로직을 전혀 건드리지 않는다.

**① 상태·감사**(`schema.prisma` + 마이그레이션)
- `RetentionState`에 `DELETING` 추가. #163 `documentVisible` default-deny라 상세(410)·저장 CAS(TEMPORARY 가드)엔 자동 안전. **목록 쿼리에는 명시적으로 `retentionState<>'DELETING'` 추가**(리뷰 C4 — 목록은 documentVisible 미경유, SAVED→DELETING·retainUntil 미래 엣지 대비).
- **`DeletionAudit`**(append-only): `id·documentId·userId·reason·keys(String[])·pageCount·createdAt`. **삭제 전에 기록**(행·랜덤키 사라진 뒤 유일한 포렌식 흔적).

**② 후보 판정 순수 함수**(`packages/db/src/retention-ops.ts` 신규, 시계 주입)
- `RETENTION_DELETE_LAG_DAYS = 3`(안전 지연 — 410 차단 시점과 분리, skew·오확정·지원 복구 여유).
- `isTemporaryHardDeletable(doc, now)`: `retentionState='TEMPORARY' AND status∈{done,partial,failed,expired 제외? → 아래} AND retainUntil!=null AND retainUntil + LAG <= now`.
  - 대상은 **retainUntil이 설정된(= terminal done|partial) 문서**. draft/failed/expired는 retainUntil=null이라 자연히 제외(알려진 누수: 중단 draft의 tmp 객체는 #164 비대상 — TODO).
- `deletionReason(doc, now): "free_expired"|null`.

**③ 스윕**(`apps/api .../retention` 신규 — StoragePort.delete + prisma 보유)
- **dry-run(기본)**: 후보(배치 상한) 조회 → 건수·키·바이트(head) 계획 출력, **쓰기 없음**.
- **execute(명시 플래그)**: 후보별
  1. 조건부 **DELETING CAS**(후보 술어 SQL 재검증: `retentionState='TEMPORARY' AND retainUntil+LAG<=now()`; 0행=변경됨 skip).
  2. DB에서 `Page.finalKey`(null 스킵)·`revision`·`userId` 열거 → 키 목록: finalKey, `normalizedImageKey(docId,pageId,rev)`(contracts 헬퍼), `tmp/{userId}/{docId}/{pageId}`.
  3. **DeletionAudit 기록**(삭제 전).
  4. `StoragePort.delete` 각 키 — **NotFound만 성공 처리, 그 외(transient 5xx/timeout)는 실패 → 이 문서 중단(행 삭제 안 함, DELETING 잔류 → 다음 실행 복구)**.
  5. 전 키 성공 확인 시에만 `Document` 행 삭제(cascade).
- **가드**: ① dry-run 기본, execute는 `--execute` 명시(영속 env 금지) ② **kill-switch** env(`RETENTION_SWEEP_DISABLED`) ③ **중단 상한**: 후보 수가 임계 초과면 run 전체 **중단+경보**(슬라이스 아님) ④ 배치 상한.

**④ 러너** — standalone Nest `createApplicationContext` 스크립트(`apps/api/src/scripts/retention-sweep.ts`), 사람이 수동 실행. **setInterval·부트 훅·HTTP 엔드포인트 금지**(리뷰 C6). 크론은 후속(같은 스크립트를 --execute로).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| #164 = 무료만, SAVED는 #165 | TOCTOU·immortal 제거·테스트 가능 | 이슈 범위 축소 | ✅(사용자 확정) |
| SAVED도 지금 | 이슈 원안 | lapsedAt 없음·재구독 TOCTOU·SAVED 문서 부재로 미검증 | ❌ |
| DELETING = Document enum 영속 | documentVisible 자동 숨김·복구 | enum 1값 | ✅ |
| 행 먼저 삭제 후 S3 | 단순 | 랜덤 finalKey 유실→영구 고아 | ❌ |
| 러너 standalone 스크립트(dry-run 기본) | 사람 개입·테스트·오발동 최소 | 크론 별도 | ✅ |
| worker setInterval | 템플릿 | worker delete 없음·무인 대량삭제 | ❌ |
| 안전 지연 없음(retainUntil 즉시) | 단순 | skew·오확정 즉시 영구삭제 | ❌(LAG 3일) |

## 3. 영향받는 코드 (Touched Surface)
- `packages/db/prisma/schema.prisma`(+마이그레이션): RetentionState에 DELETING · `DeletionAudit` 모델.
- `packages/db/src/retention-ops.ts`(신규, 순수) + index 재노출 + 단위.
- `packages/db/src/documents-ops.ts`: 목록 쿼리에 `retentionState<>'DELETING'`.
- `apps/api/src/modules/retention/*`(신규): service(dry-run/execute)·repository(후보·CAS·키 열거·audit·행 삭제)·module.
- `apps/api/src/scripts/retention-sweep.ts`(신규): standalone 진입(인자 파싱·kill-switch·중단 상한).
- 키: `contracts normalizedImageKey` 재사용(손으로 포맷 금지).

## 4. 데이터 / 계약 (Contracts)
- 외부 API 계약 없음(내부 잡). 결과는 로그/리턴 구조체(dry-run 계획·execute 집계). **BFF**: NO.

## 5. 위험과 완화 (Risks)
- R1 영구 데이터 손실 → dry-run 기본·중단 상한·안전 지연·DeletionAudit·DELETING 재검증 CAS·kill-switch.
- R2 고아(S3/DB) → DB 전 S3 열거·전 키 성공 후에만 행 삭제(NotFound만 성공)·DELETING 영속 복구·멱등.
- R3 목록에 DELETING 노출(SAVED→DELETING·retainUntil 미래) → 목록 쿼리 `retentionState<>'DELETING'`.
- R4 multi-revision(TASK-007) 구키 누수 → 현재 rev만 열거 → **알려진 후속 TODO**(지금 rev=1).
- R5 중단 draft/failed tmp 누수 → retainUntil null이라 비대상 → **알려진 후속**(별도 정리).

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 마이그레이션(DELETING·DeletionAudit) + 코드 + 스크립트. 크론 미등록. **dry-run으로만 먼저 운영 확인** 후 execute.
- 되돌리기: 스크립트 미실행·enum 미사용(데이터 안전). DELETING 전환·삭제 후는 비가역(그래서 dry-run·상한·audit 선행).

## 7. 검증 (Verification)
- 단위: `isTemporaryHardDeletable`(LAG 경계·retainUntil null·상태), 키 열거(finalKey null·normalized·tmp), 멱등/NotFound 성공·transient 중단, 행 삭제 게이트(전 키 성공 시만).
- 통합(격리 데이터·실 Postgres+MinIO, gate 밖): dry-run 집계 = 실제 대상 / execute 후 대상 DB·S3 0건·비대상 무영향·재실행 멱등·중단 상한 동작.
- `bash agents/harness/evals/checks.sh` ALL PASS(prisma validate·api/db 단위).
