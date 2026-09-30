# 0020 — 분석 요청·jobId 상태 폴링 (analysis pipeline)

> **관련 태스크**: #63 (TASK-003) · **상태**: shipped (PR #64 develop 머지, 2026-09-28) · **유형**: feature (세로 슬라이스)
> **depends**: 업로드 [0018]·[0019] · [backend-architecture.md] · 도메인 [document-page]·[analysis-job]
> **unblocks**: OCR·위험조항·하이라이트(TASK-004) · 페이지 교체·재분석(TASK-007)
> **설계 회의**: Codex 2R 토론 반영(2026-09-28) — 아래 §회의 반영. product 흐름: feature `analyze-document`. 지식 베이스: Notion 07 §분석 파이프라인.
> **핵심 결정**: job 모델 **A(resumable 단일 job)** · **DB=접수·상태의 진실, 큐=실행 전달 수단** · entitlement 원자적 예약은 **TASK-005 이관** · **무료 차감 정책 확정(2026-09-30)**: `done`만 1회 차감(partial·failed·invalid 무차감), 완료 시점 확정, `AnalysisJob.id` 멱등키.

## PRD (왜/무엇)

### 1. 문제
업로드가 끝난 `Document`(status=uploaded)를 실제로 **분석**할 방법이 없다. OCR·위험조항 분석은 수십 초가 걸리므로 HTTP 요청 안에서 동기 처리할 수 없다. **요청 즉시 jobId를 돌려주고**, 앱이 **상태를 조회·구독**해 진행/완료/부분/실패를 표현하는 비동기 파이프라인이 필요하다. 없으면 결과 표시(TASK-004)가 막힌다.

### 2. 목표
- G1. **AnalysisJob(문서당 1개)·PageAnalysis(페이지별)** 모델(Prisma) — 부분 실패·재개·집계를 표현.
- G2. `packages/contracts` **zod 계약** 확장 — analyze·status 응답(transport-무관, `stateVersion` 포함).
- G3. **`POST /documents/:id/analyze`**(인증·멱등) — 검증 후 접수 트랜잭션 + **enqueue + jobId 즉시 반환**.
- G4. **`GET /documents/:id/analysis`** — 상태 + 페이지별 결과 + `stateVersion` = **진실의 기준**(재진입·재연결 fallback).
- G5. **SSE 스트림**(`GET /documents/:id/analysis/stream`) — 진행/완료 push(Redis pub/sub). GET과 동일 shape.
- G6. **QueuePort + BullMQ 어댑터**(api=producer). `apps/worker` = **공통 processor + `StubOcrAdapter`**(OcrPort). 실제 Vision은 TASK-004.
- G7. 앱: `분석하기`(업로드 완료 후) → 분석 요청 → PROCESSING → SSE 구독 + 재연결/저빈도 GET 보정 → done/partial/failed 표현.

### 3. 비목표 (다음 태스크)
- **실제 Google Vision OCR·텍스트/좌표 정규화·위험조항 분석·하이라이트**(TASK-004/06). 이번 worker는 **StubOcrAdapter**(결정적 성공/일시실패/영구실패/타임아웃 재현).
- **이미지 실검증(디코딩·실측 크기·픽셀/메모리/처리시간 제한·손상 분류)** → **TASK-004** (실제 OCR 활성화 전 필수조건). 이번엔 명시적 이관만.
- **entitlement 무료횟수 원자적 예약·실차감·한도 집행** → **TASK-005**. 이번엔 **차감 정책 + `AnalysisJob.id` 멱등키만** 명시(빈 예약 서비스도 안 만듦).
- **페이지 교체·revision 증가·재분석**(TASK-007) — `revision` 스냅샷 검증은 지금 반영, 분석 중 교체는 금지.
- **광범위 운영 reconciler(큐 유실·장기 정체·재시도 소진 포괄)·이벤트 재생 저장소·APNs/FCM 앱-꺼짐 푸시·부하 테스트·dead-letter 대시보드**.

### 4. 제약 (Guardrails)
- **서버가 진실의 기준** — 앱은 위험/권한/완료를 판단하지 않고 서버 상태를 표현만. **DB=접수·상태의 진실, Redis/큐=실행 전달 수단**("Redis 단일 진실" 표현 폐기).
- **요청·결과 분리** — analyze는 OCR 완료를 기다리지 않는다(jobId 즉시).
- **멱등** — 동일 논리요청은 terminal 이후에도 **같은 jobId 반환**. worker 처리는 재실행 안전(결과 upsert·terminal no-op).
- **로그 금지** — 이미지 원문·OCR 텍스트·토큰·PII·Presigned URL 로그 금지(예외/응답 본문 포함). **SSE 토큰 URL query 금지**.
- **비밀값 env로만**(Redis/저장소 크리덴셜). 층/포트: Controller→Service→Repository, 큐는 **QueuePort로만**.
- **worker는 api를 import하지 않는다** — 교차 테이블 확정 연산은 **`packages/db`의 좁은 명령 함수**로 추출, api·worker Repository가 호출(HTTP·Redis·Vision 의존 없음).
- 인증 필수(`JwtAuthGuard`), Document는 userId 소유(교차 접근 거부, GET·SSE도 소유권 검사).
- **인프라 전제**: Redis 영속화(AOF/RDB) on(실행 전달 손실 최소화). 단 최종 방어선은 DB 멱등.

### 5. 사용자 흐름 (feature analyze-document)
```
Document(status=uploaded) → [분석하기]
  → POST /documents/:id/analyze   (JWT, 멱등)
      · 문서행 잠금 → 소유권 → 기존 분석(활성 or terminal) 조회 → 있으면 그 jobId 반환 → (없을 때만) status=uploaded·entitlement(정책) 검사
      · 접수 트랜잭션: Document=analyzing + AnalysisJob(queued, stateVersion=1)
        + PageAnalysis(pending)×N  (활성 job 문서당 1개 = 부분 유니크 인덱스로 강제)
      · 커밋 후 enqueue(문서 job 1개). enqueue 누락은 reconciler가 미전달 재전달
    ← { jobId, documentId, status, pages:[{pageId,order,status,revision}], stateVersion }
  → 앱: PROCESSING + SSE 구독(GET .../analysis/stream)
      · worker(공통 processor): job 소비 → 미완료 PageAnalysis 순회
          → StubOcrAdapter(결정적 성공/실패/타임아웃) → confirmPageAnalysisTx(잠금·revision 재검사·집계)
          → 문서 상태변경 트랜잭션에서 stateVersion++ → Redis publish
  → 앱 백그라운드/재진입/연결 끊김 → GET /documents/:id/analysis 재fetch(복원, stateVersion로 병합)
  → 모든 페이지 terminal → Document = done | partial | failed 집계
    ← done/partial/failed 화면 (결과·하이라이트 표시는 TASK-004)
```

### Acceptance (feature analyze-document 기준)
- [x] 분석 요청은 중복 탭·POST 재전송에도 **한 번만 접수**(같은 jobId, terminal 이후에도 동일).
- [x] API는 **OCR 완료를 기다리지 않고 jobId를 반환**한다.
- [x] 앱 종료 후 재진입해도 **서버 job 상태를 복원**(GET = 진실의 기준, stateVersion 병합).
- [x] **페이지별 실패/성공 구분**(errorCode·retryable 포함).
- [x] 완료 결과가 **현재 page revision과 일치**(커밋 직전 재검사, stale 종결).
- [x] 무료 횟수 차감은 **서버 결과와 동기화** — 정책 확정(2026-09-30) + `AnalysisJob.id` 멱등키 규약 명시. 실차감·원자적 예약·한도 집행은 TASK-005. **차감 정책**: `done`만 1회 차감 · `partial`·`failed`·`invalid_image`는 **무차감** · 차감 시점=완료(terminal) 확정 · 멱등키=`AnalysisJob.id`(최대 1회).
- [x] worker 크래시·재시도·enqueue 누락에도 결과·상태 일관(멱등 확정·재집계·재전달) — stub worker로 검증.
- [x] SSE 구독 중 push 수신, 연결 끊김·역순 도착에도 stateVersion로 상태 후퇴 없음.
- [x] Presigned URL·이미지·토큰·OCR 텍스트 로그 없음 · `checks.sh` PASS.

## SDD (어떻게)

### ① 데이터 모델 (packages/db/prisma)
```prisma
enum AnalysisJobStatus  { queued processing done partial failed }
enum PageAnalysisStatus { pending processing done failed }
// DocumentStatus 에 partial 추가: draft uploaded analyzing done partial failed expired

model AnalysisJob {
  id               String  @id @default(cuid())   // = 논리적 분석 요청 ID(멱등·과금 단위). 큐 전달 ID와 구분
  documentId       String
  document         Document @relation(fields:[documentId], references:[id], onDelete: Cascade)
  status           AnalysisJobStatus @default(queued)
  totalPages       Int
  stateVersion     Int      @default(1)             // 상태변경 tx마다 ++ (페이지 상태만 바뀌어도 ++; 역순 도착 방지)
  dispatchedAt     DateTime? @db.Timestamptz        // 큐 전달 확인 기록. 활성 job인데 미기록=미전달 후보 → reconciler 재전달
  createdAt        DateTime @default(now()) @db.Timestamptz
  updatedAt        DateTime @updatedAt @db.Timestamptz
  pages            PageAnalysis[]
  @@index([documentId, status])
  // 활성 job 문서당 1개 = 부분 유니크 인덱스(SQL 마이그레이션):
  //   CREATE UNIQUE INDEX uniq_active_job ON "AnalysisJob"("documentId")
  //   WHERE status IN ('queued','processing');
}

model PageAnalysis {
  id          String @id @default(cuid())
  jobId       String
  job         AnalysisJob @relation(fields:[jobId], references:[id], onDelete: Cascade)
  pageId      String
  revision    Int                                  // 접수 시 Page.revision 스냅샷 = 확정 시 일치 기준(분석 중 교체 금지). 문서 세대가 필요하면 Document.currentAnalysisJobId로 별도 표현
  status      PageAnalysisStatus @default(pending)
  errorCode   String?                              // 사용자용 오류 코드(원문 텍스트 금지)
  retryable   Boolean @default(false)              // 사용자 재시도 가능 여부(자동 재시도 예산과 별개)
  attempts    Int     @default(0)
  confirmedAt DateTime? @db.Timestamptz
  createdAt   DateTime  @default(now()) @db.Timestamptz
  @@unique([jobId, pageId])                        // 멱등 upsert 키
  // 결과 본문(OCR 텍스트·boxes·조항)은 TASK-004에서 별 테이블. 이번엔 상태만.
}
```
- **집계는 증분 카운터 대신 잠금 하 재집계**(최대 20페이지 → 단순·드리프트 없음). 필요 시 카운터 병기하되 재집계 값으로 저장.

### ② 계약 (packages/contracts, zod — transport-무관)
- `analyzeResponse` = `statusResponse` (POST·GET·SSE 동일):
  `{ jobId, documentId, status(DocumentStatus), stateVersion, job:{status,totalPages}, pages:{pageId,order,status,revision,errorCode?,retryable?}[] }`
- SSE 이벤트: `event: status` + `data: <statusResponse>` (스냅샷 전체). 앱은 **같은 job의 큰 stateVersion만 적용**.
- 오류 코드 상수: `not_uploaded`·`not_owner`·`expired`·`ocr_timeout`·`ocr_failed`·`invalid_image`(TASK-004 활성) 등. 버전 규칙 추후.

### ③ 백엔드 구조 (도메인 경계)
- **`documents` 모듈**(상태 소유): `startAnalysis(userId, documentId)` — **문서행 잠금 → 소유권 → 기존 분석(활성 or terminal) 조회 → (없을 때만) 접수 자격(status·정책) 검사** 순서(uploaded/자격을 먼저 강제하면 정상 중복요청·terminal 재요청이 실패하므로 순서 준수). 기존 분석 있으면 그 jobId 반환(**terminal 포함**, 재분석 비목표), 없으면 접수 트랜잭션(Document=analyzing+Job+Pages) 후 반환. `getAnalysis(userId, documentId)` **일관 DB 스냅샷**(버전·본문 동일 스냅샷) 조회.
- **`analysis` 모듈**(신규): producer + 상태/SSE 컨트롤러.
  - `analysis.controller`: `POST :id/analyze`, `GET :id/analysis`, `GET :id/analysis/stream`(`@Sse`).
  - `analysis.service`: DocumentsService 호출 + QueuePort.enqueue + Redis 구독→SSE 브리지 + 접수 후 미전달 재전달(좁은 reconciler).
- **ports/queue.port**: `enqueueAnalysis(jobId)` (A: 1개). **adapters/bullmq-queue.adapter**: `bullmq` Queue(producer). 상태 알림은 **별도 얇은 pub/sub**(queue completed 이벤트와 도메인 완료를 섞지 않음).
- **`apps/worker`**(NestJS standalone): `bullmq` Worker → **공통 processor**(입력 조회 → `OcrPort` → 결과 확정 → 알림). 이번엔 `StubOcrAdapter`(결정적 성공/일시실패/영구실패/타임아웃, 운영에서 가짜 성공 기본 금지). `VisionOcrAdapter`는 TASK-004.
- **`packages/db`**: 교차 테이블 확정 연산 `confirmPageAnalysisTx(...)`·`recoverPendingDispatch(...)`를 **좁은 명령 함수**로 추출(api·worker 공유). `src/jobs.ts` = 큐 payload 타입 `{ jobId, documentId }`.

### ④ job 모델 — A: resumable 단일 job (채택)
분석요청 시 **문서 job 1개** enqueue. worker가 미완료 `PageAnalysis`를 순회(제한 동시성 가능), 페이지별 성공/실패를 PageAnalysis에 기록, 영구 실패는 남기고 나머지 계속. 재실행 시 **완료 페이지 건너뛰기**. 근거·대안은 §⑧.
- **B(페이지 fan-out) 전환은 비교적 가역적(비용 하~중, 운영 전환 검증 포함 시 중)**: `confirmPageAnalysisTx`를 job 순회와 분리해 두면 전환 범위가 좁아진다(enqueue N개 + reconciler 재등록 대상 페이지 단위). `processPage` **별도 함수 분리는 선택**(작은 내부 함수면 족함, 강제 아님). 전환 시 **동시 완료·중복 전달·일부 enqueue 실패 검증 + 기존 A job 배출**이 필요. **지금 B용 dispatch 전략 포트·별도 논리요청 ID 체계는 만들지 않음**(과설계).

### ⑤ 멱등·내구성·실패 정책
| 상황 | 처리 |
|---|---|
| 중복 analyze / POST 재전송 | 활성 job 있으면 같은 jobId. terminal 이후 재전송도 같은 분석 반환(재분석 비목표) |
| 활성 job 유일성 | **부분 유니크 인덱스**(status∈queued,processing) + 문서행 잠금. 충돌 시 승자 재조회 반환 |
| worker 크래시 | job은 Redis → stalled 자동 재큐(BullMQ). stalled 한도 초과는 큐 failed로 이동 |
| enqueue 누락 | DB 커밋 후 enqueue 전 크래시 → **미전달 재전달**(좁은 reconciler; DB가 접수 진실). 판정=활성 job인데 `dispatchedAt` 미기록. enqueue 성공 후 확인 기록 전 크래시에도 재전달 안전(중복 전달은 job 멱등으로 무해) |
| 재실행(at-least-once) | 결과 **upsert**(`@@unique(jobId,pageId)`) + **비종결→종결을 실제 수행한 경우만** 집계·정산 반영, terminal 중복완료 no-op |
| 집계 | 문서/job 잠금 하 **페이지 상태 재집계** → done/partial/failed |
| revision 불일치 | 처리 시작·**커밋 직전** 재검사(같은 tx; 기준=`PageAnalysis.revision` vs 현재 `Page.revision`, revision 변경과 결과 확정이 **동일 잠금 규약**). stale은 비재시도 오류로 **종결**(단순 return 금지 — 활성 job 제약에 이후 분석 막힘) |
| 자동 재시도 vs 사용자 재시도 | `attempts` 소진=자동 예산 종료 ≠ `retryable=false`. 일시 장애는 사용자 재시도 가능으로 표기 |
| 무료횟수 | **차감 정책 확정(2026-09-30)**: `done`만 1회 차감 · `partial`·`failed`·`invalid_image` 무차감 · 차감 시점=terminal 확정 · 멱등키=`AnalysisJob.id`(최대 1회, 재연결·재시도·중복완료 이벤트에도 1회). 원자적 예약·실차감·한도 집행 = TASK-005 |

### ⑥ SSE·복원 (foundation)
- worker→Redis channel(`{env}:analysis:{documentId}`) publish(공유 Redis 대비 env prefix) → api 각 인스턴스 구독 → 해당 문서 SSE 스트림 push.
- **응답 shape = GET과 동일 + stateVersion** → 앱은 push든 fetch든 동일 처리(교체 가능), 같은 job의 큰 버전만 적용.
- **stateVersion 증가 범위**: Document가 계속 `analyzing`이어도 **페이지 상태만 바뀌면 ++**. GET·SSE의 버전과 본문은 **동일 DB 스냅샷**에서 읽는다(자기모순 응답 방지).
- 최초 연결 = **구독 준비 → DB 스냅샷 GET → 버전 병합**. 재연결/활성 분석 중 **저빈도 GET 보정**(SSE는 빠른 알림, DB 커밋 후 publish 유실은 연결 유지 중에도 발생). "폴링 QPS 제거"는 "대부분 감소"로 완화.
- 운영: API 인스턴스별 로컬 구독자 관리 + **마지막 연결 종료 시 구독·리스너 정리(refcount)**, 느린 클라이언트는 최신 스냅샷 1개만 유지, heartbeat·프록시 idle timeout·재연결 backoff+jitter. **JWT·소유권 매 연결 검사, bearer token URL 금지**. 재연결이 다른 인스턴스로 가도 GET 복원 → **sticky session 불필요**.

### ⑦ 앱 (apps/mobile/src/features/analysis — FSD)
- `api/analysisApi`(contracts 타입·`.parse()`), `model/useAnalysis`(analyze→SSE 구독→상태 반영, stateVersion 병합, 재연결·저빈도 GET 보정, runId 무효화), `model/analysisStore`. `분석하기`(업로드 완료 후) 연결 + PROCESSING/부분/실패 UI. 토큰은 app 레이어 주입(feature→feature import 금지).

### ⑧ 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| **A. resumable 단일 job** | 집계 단순·분산 복구 없음·유지보수↑ | 문서 내 순차(제한 동시성) | ✅ |
| B. 페이지 fan-out | 문서 내 페이지 병렬·독립 재시도 | 분산 집계·부분 등록 복구 복잡 | ❌(지금 불필요, 가역 전환) |
| 폴링만(SSE 없음) | 단순 | read QPS·지연 | ❌(SSE foundation) |
| SSE만(GET 없음) | — | 재진입·재연결 복원 불가 | ❌(GET 필수) |
| entitlement 원자적 예약 지금 | 동시 한도 보호 | 실차감 없는데 예약만 뜸(과설계) | ❌ → TASK-005 |
| dispatch 전략 포트·processPage 강제 분리 | B 전환 대비 | 빈 추상화(원칙 위반) | ❌ |

- 부분실패·재과금 방지는 **큐 개수 아닌 PageAnalysis 책임** → A도 동일. "재과금 없음"은 보장 불가(Vision 성공 후 DB 저장 전 크래시 시 재호출) → **"커밋된 성공 페이지 재호출 방지"**로 표현, 호출 동시성·비용 상한 명시.

### ⑨ 파일·순서 계획
1. contracts(analyze/status zod + stateVersion + 오류상수) → 2. db(AnalysisJob·PageAnalysis·enum·**부분 유니크 인덱스 SQL**·마이그레이션 + jobs.ts + `confirmPageAnalysisTx`/`recoverPendingDispatch`) → 3. documents.startAnalysis/getAnalysis(잠금·검사순서·접수 tx) → 4. analysis 모듈(controller·service·QueuePort·bullmq adapter·SSE·pub/sub·좁은 reconciler) → 5. worker(공통 processor·OcrPort·StubOcrAdapter·집계·publish) → 6. 단위테스트 → 7. **실측**(Redis+docker) → 8. 앱 analysis feature + 분석하기 연결 → 9. e2e 시나리오(트리거 규칙).

### ⑩ 위험 (Risks)
- R1 집계·완료 경쟁(마지막 두 페이지 동시 완료 → 종결 누락/중복) → 잠금 하 재집계 + terminal no-op.
- R2 enqueue 누락(커밋 후 크래시) → 좁은 reconciler(DB 접수 기준 재전달).
- R3 stale(분석 중 교체) 종결 경로 없으면 활성 job 제약에 영구 대기 → 비재시도 종결.
- R4 SSE 이벤트 유실(publish 전 크래시·구독 단절) → 저빈도 GET 보정 + 재연결 재동기화.
- R5 stub↔실제 Vision 인터페이스 어긋남 → 공통 processor + OcrPort로 이번에 경계 확정.

### ⑪ 검증 계획 (Verification) — 실패 주입 우선
- 단위: contracts, startAnalysis(잠금·검사순서·멱등·활성 유일성), confirmPageAnalysisTx(재집계·terminal no-op·revision 커밋직전·done/partial/failed), stateVersion 병합, SSE 브리지, guard.
- 통합/수동(docker Redis+Postgres) **실패 주입**:
  - 같은 문서 동시 POST·완료 후 재전송 → 같은 job.
  - DB 접수 직후 종료·enqueue 누락 → reconciler로 결국 처리.
  - 같은 페이지 중복 완료·마지막 두 페이지 동시 완료 → 정확한 집계·완료 1회.
  - 성공 뒤 늦은 실패·이전 실행이 새 상태 뒤 도착 → 후퇴 없음(stateVersion).
  - OCR 중 revision 변경 → stale 미노출·영구 대기 없음.
  - 결과 커밋 후 publish 유실·Redis 구독만 단절·GET/SSE 역순 → 최신 수렴.
- e2e(앱): 분석하기→PROCESSING→done/partial(반자동). 시나리오 추가.
- 게이트: `checks.sh` PASS. (mock 단위만으로 잠금·유일성·다중 프로세스 경쟁을 검증했다고 판단하지 않음.)

### 검증 결과 (백엔드 슬라이스 — 2026-09-28)
- **게이트**: `checks.sh` ✅ ALL PASS(13검사 — Build(contracts)·**Build(db)**·Typecheck(mobile/api/**worker**)·Prisma validate·Expo Doctor·lockfile·native singleton·Unit(contracts 15·api 44·**worker 6**·mobile)).
- **DB**: 마이그레이션 `add_analysis_jobs` 실 DB 적용 + **부분 유니크 인덱스**(활성 job 문서당 1개) 적용.
- **실측(실 HTTP + docker Postgres/Redis + api·worker stub, 4/4 PASS)**:
  - 전체 성공: analyze 200 → **멱등(2회 호출 같은 jobId)** → worker done → `Document/Job=done`, `stateVersion=3`, 페이지 2 done.
  - 부분 실패: 한 페이지 영구 실패 주입 → `Document/Job=partial`, page0 done·page1 `failed(ocr_failed)` — **페이지 단위 격리** 확인.
  - DB 정합성: AnalysisJob(done/partial·dispatched=t)·PageAnalysis(done×3·failed×1·attempts=1)·Document(done/partial) 일치.
  - **SSE**: analyze 후 스트림 초기 스냅샷 + worker 처리 중 **실시간 push로 analyzing→done 전이 관찰**(Redis pub/sub→api→SSE 전 경로).
- **앱(RN) 연동**: `features/analysis`(SSE 클라이언트 react-native-sse + GET fallback + 재연결 재fetch + **stateVersion 역순 방어** + 저빈도 폴링 보정). app 레이어에서 업로드 완료 시 **분석 자동 시작**, upload+analysis 상태 병합 UI(분석 요청 중→분석 중 n/N→완료/부분/실패). 단위 6(analysisApi·useAnalysis). e2e S19(반자동).
- **게이트 최종**: `checks.sh` ✅ ALL PASS(13검사, 단위 115: contracts 15·api 44·worker 6·mobile 50).
- **앱 시뮬레이터 end-to-end 실측(2026-09-28, PASS)**: iPhone 17 Pro + 로컬 API/worker(stub)/Redis/MinIO. 앱 UI `분석하기` → **MinIO 직접 업로드 → Redis 큐 → worker → confirmPageAnalysisTx → done → SSE/GET 앱 반영 → "분석 완료"**. DB 확인: 앱 세션(clientRequestId `cl_...`) `AnalysisJob=done`(sv=2·dispatched=t)·`Document=done`·`PageAnalysis` done. react-native-sse(순수 JS)는 prebuild 없이 크래시 없이 로드·동작.
- **미검증(후속)**: worker 크래시 stalled 재큐(BullMQ 기본 ~30s — 단위로 재실행 안전·skip-done 검증), 실제 Vision OCR·이미지 실검증(TASK-004).

### §회의 반영 (Codex 2R 토론 요약)
- **R1(16지적, P1 9)**: enqueue 누락 영구 analyzing·활성 job 유일성 경쟁·upsert+카운터 비멱등·revision 비교 대상·BullMQ↔DB 복구·SSE 유실·도착순서 후퇴·완료차감 동시경쟁·요청멱등 혼재·partial 계약·A 과소평가·이미지 실검증 공백·stub 범위·worker 상태권한/공유코드·SSE 운영·문서 SQS 잔재.
- **토론(전환비용 + 반론)**: A→B **가역(하~중)**. 반론 인정 → **entitlement 원자적 예약 TASK-005 이관**, **dispatch 포트·processPage 강제 분리·별도 논리요청 ID 철회**(과설계), reconciler는 **enqueue 누락 재전달(좁은)만** 이번. **DB=접수·상태 진실, 큐=전달**.
- **이번 최소 P1(8→5)**: ①접수 유일성 ②enqueue 누락 복구 ③재실행 안전 확정·집계 ④원자적 revision 검증 ⑤stateVersion+GET 보정.
- **이관**: entitlement 예약(TASK-005) · 이미지 실검증·운영 reconciler·실제 Vision(TASK-004).
- **R2 판정(2026-09-28)**: **착수 승인**(새 P1 blocker 없음, A+최소 P1 정합·과설계 회귀 없음). R2 P2 4건(terminal 재요청 분기·미전달 판정 `dispatchedAt`·stateVersion 증가범위·revisionSnapshot 정리)·P3(전환비용 문구·processPage 선택)을 **본 문서에 반영 완료**.
- **다음**: 구현 착수(파일·순서 계획 §⑨).
