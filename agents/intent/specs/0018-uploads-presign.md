# 0018 — 업로드 Presigned URL (POST /uploads/presign)

> **관련 태스크**: #15 (TASK-002) · **상태**: in-progress(설계 — Codex 회의 2R 반영) · **유형**: feature (첫 세로 슬라이스)
> **depends**: 인증 [0008]·[0009] · [backend-architecture.md] · 도메인 [upload-storage]·[document-page]
> **unblocks**: 프론트 업로드(TASK-002) · 분석 요청(TASK-003, #16)
> **설계 회의**: Codex 2라운드 리뷰 반영(2026-09-22) — 아래 §회의 반영. product 흐름: Notion 02 §9 3~4단계.

## PRD (왜/무엇)

### 1. 문제
로컬 Draft(이미지들)를 서버가 접근 가능한 S3 호환 저장소(로컬 MinIO / 프로덕션 Railway Bucket)에 올릴 방법이 없다. 앱은 **API를 거치지 않고 저장소에 직접 업로드**하고, 서버는 **업로드용 presigned URL + 안전한 imageKey**만 발급·확정해야 한다. 없으면 분석(TASK-003)이 막힌다.

### 2. 목표
- G1. `packages/contracts` **zod 계약** 첫 도입(앱↔API 단일 소스).
- G2. **`Document`·`Page` 모델**(Prisma) — 계약 세션·페이지.
- G3. **`POST /uploads/presign`**(인증·멱등) — 세션 생성 + 임시키 presigned PUT URL(배치) 발급.
- G4. **`POST /uploads/{documentId}/reprisign`**(인증) — 미확정 페이지 URL 재발급(복구).
- G5. **`POST /uploads/{documentId}/complete`**(인증·멱등) — 후보키 copy·검증·원자적 확정.
- G6. **StoragePort + MinioStorageAdapter**(AWS SDK v3). 인프라 교체 시 어댑터만.
- G7. 앱: presign → 임시키 직접 PUT(진행률·재시도) → complete. Draft에 서버 ID 보존(복구).

### 3. 비목표 (다음 태스크)
- **분석요청·jobId·OCR·전체 이미지 디코딩/픽셀 제한/손상분류**(TASK-003/#16) · **entitlement 차감**(TASK-005) · 위험조항/하이라이트.
- **페이지 교체·revision 증가·재분석**(TASK-007) — 단 `revision` 필드는 지금 추가(`=1`).
- 웹 CORS·고급 병렬/자동재시도 UX · 대규모 정리 시스템/대시보드(운영 배포 전 **최소 정리 실행경로**는 필수).

### 4. 제약 (Guardrails)
- **imageKey·후보키는 서버 생성** — 클라 임의 경로 금지. **확정된 최종 참조는 앱이 못 씀**(덮어쓰기 불가).
- **presigned URL·토큰·이미지 원문 로그 금지.** 저장소 크리덴셜 env로만(앱은 만료 URL만).
- **서버가 진실의 기준** — 크기·MIME·매직바이트 검증, userId 소유권, 저장소 키는 **DB에서만** 읽음.
- 층/포트: Controller→Service→Repository, 외부자원은 StoragePort로만. **Document/Page 상태 소유는 `documents` 도메인**(uploads는 검증·서명·copy 조율만).
- 인증 필수(`JwtAuthGuard`), Document는 userId 소유.

### 5. 사용자 흐름 (Notion 02 §9)
로그인은 앱 게이트에서 이미 완료. 이후:
```
Draft(이미지 N장) → [분석하기]
  → POST /uploads/presign { clientRequestId, pages:[{order,contentType,sizeBytes,width?,height?}] }  (JWT)
      · 멱등키(userId+clientRequestId)로 Document(draft)+Page(pending)×N 생성(있으면 재사용)
      · 임시키 tmp/{userId}/{uuid} presigned PUT URL 발급(배치, TTL 5~10m)
    ← { documentId, pages:[{pageId,order,tmpKey,uploadUrl,expiresAt}], sessionExpiresAt }
  → 앱: 각 이미지를 uploadUrl로 임시키에 직접 PUT (진행률·실패 재시도)
      · URL 만료/실패 → POST /uploads/{documentId}/reprisign 로 미확정 페이지 URL 재발급
  → POST /uploads/{documentId}/complete { pageIds:[...] }  (JWT, 멱등)
      · 소유권·pageIds 소속 검증 → 페이지별: tmp HEAD(크기==expected, MIME, 매직바이트)
      · 검증 통과분을 후보키 documents/{documentId}/pages/{pageId}/r1/{attemptId} 로 copy(조건부)
      · 짧은 DB 트랜잭션(문서 행 잠금·저장소 호출은 잠금 밖)에서 Page 확정 + 전체 uploaded면 Document=uploaded
    ← { documentId, status, pages:[{pageId, status, error?, retryable?}] }
  → (다음) 분석 요청 = TASK-003
```

### Acceptance
- [ ] contracts에 presign/reprisign/complete 요청·응답 zod 스키마, 앱·API 공유
- [ ] `Document`·`Page`(+`revision`,`expiresAt`,`confirmedAt`,`expectedSize`) 모델 + 마이그레이션(실 DB)
- [ ] presign 멱등(`UNIQUE(userId, clientRequestId)`) — 동일키 동일세션, 다른 payload는 409
- [ ] 임시키 PUT → complete가 **후보키로 copy·검증·원자 확정**, 확정 최종참조는 앱 미접근
- [ ] complete 조건 = **모든 페이지 uploaded**일 때만 Document uploaded(부분은 페이지별 결과)
- [ ] 동시 complete·응답 유실·copy 후 DB 실패·삭제 실패에도 상태 일관(테스트)
- [ ] 크기 정확 일치·MIME·매직바이트 검증, 잘못된 타입/크기/교차문서 pageId 거부
- [ ] 로컬 MinIO 실측(presign→PUT→complete) · URL·원문 로그 없음 · `checks.sh` PASS

## SDD (어떻게)

### ① 데이터 모델 (packages/db/prisma)
```prisma
enum DocumentStatus { draft uploaded analyzing done failed expired }
enum PageStatus     { pending uploaded }   // 실패는 영속상태 아님 → complete 응답의 error/retryable로 표현

model User { /* ... 기존 ... */ documents Document[] }

model Document {
  id              String  @id @default(cuid())
  userId          String
  user            User    @relation(fields:[userId], references:[id], onDelete: Cascade)
  clientRequestId String                     // 멱등키(요청 지문 저장 권장)
  status          DocumentStatus @default(draft)
  pages           Page[]
  expiresAt       DateTime @db.Timestamptz   // 세션 만료(정리 기준). URL TTL과 분리
  createdAt       DateTime @default(now()) @db.Timestamptz
  updatedAt       DateTime @updatedAt @db.Timestamptz
  @@unique([userId, clientRequestId])
  @@index([userId, status])
}

model Page {
  id           String @id @default(cuid())
  documentId   String
  document     Document @relation(fields:[documentId], references:[id], onDelete: Cascade)
  order        Int
  revision     Int     @default(1)           // 교체/재분석은 TASK-007, 필드는 지금
  contentType  String
  expectedSize Int                            // presign 시 저장(정확 일치 검증)
  width        Int?                           // 클라값=비신뢰(참고). 실검증은 #16
  height       Int?
  finalKey     String?  @unique               // 확정된 후보키(copy 목적지). 확정 전 null
  status       PageStatus @default(pending)
  confirmedAt  DateTime? @db.Timestamptz
  createdAt    DateTime  @default(now()) @db.Timestamptz
  @@unique([documentId, order])
}
```
- 세션 생성 후 **페이지 추가/삭제/재정렬 금지**(이 슬라이스 단순화). imageKey 대신 tmpKey(비영속·규칙 생성) + finalKey(확정, DB).

### ② 계약 (packages/contracts, zod)
- `presignRequest`: `{ clientRequestId, pages:{order,contentType(enum 화이트리스트),sizeBytes(1..MAX),width?,height?}[](1..20) }`
- `presignResponse`: `{ documentId, sessionExpiresAt, pages:{pageId,order,tmpKey,uploadUrl,expiresAt}[] }`
- `reprisignRequest`: `{ pageIds:string[] }` → 미확정 페이지 새 uploadUrl
- `completeRequest`: `{ pageIds:string[] }` → `completeResponse`: `{ documentId, status, pages:{pageId,status,error?,retryable?}[] }`
- 상수: 허용 MIME(`image/jpeg|png|webp`), 페이지당 최대 크기(예 15MB), 페이지≤20, 사용자당 **미완료 Document≤5(만료분 제외)**.

### ③ 백엔드 구조 (도메인 경계 — Round1 P1-5)
- **`documents` 모듈 — 공개 서비스**가 상태 소유:
  - `createOrGetSession(userId, clientRequestId, pages)` — 멱등 생성/재사용(payload 충돌 409)
  - `confirmPages(documentId, userId, confirmations[])` — **하나의 DB 트랜잭션**에서 미확정 Page에 finalKey 연결 + 전체 uploaded 계산·전이(analyzing/done이면 후퇴 금지). 저장소 호출은 이 트랜잭션 **밖**.
  - `listPending`, `getForRepresign`
- **`uploads` 모듈** — 검증·서명·copy 오케스트레이션(상태변경은 documents 호출):
  - presign: DocumentsService.createOrGetSession → StoragePort.presignPut(tmpKey)
  - complete: 페이지별 tmp HEAD→후보키 copy(조건부)→후보 HEAD/매직바이트 검증 → DocumentsService.confirmPages → 임시키·미선택 후보 정리
- **ports/storage.port**: `presignPut({key,contentType,sizeHint?,expiresIn})`·`headObject(key)`·`copyObject({from,to,ifMatchETag?})`·`deleteObject(key)`
- **adapters/minio-storage.adapter**: `@aws-sdk/client-s3`+`s3-request-presigner`. copy 성공은 **응답 본문까지 확인**(CopyObject는 200에 에러 포함 가능). 주소방식(path/virtual-hosted)·endpoint·region **env 분리**.

### ④ 불변성·동시성 — 후보키 방식 (Round2 P1-2·P1-4 핵심)
complete는 시도마다 **새 후보키**(`.../r{revision}/{attemptId}`)로 copy → 그 후보를 검증 → DB에서 finalKey로 채택. 효과:
- 앱은 **임시키에만** 쓰고 최종참조엔 못 씀 → 확정 후 덮어쓰기 불가.
- 두 complete 동시 실행 → **승자 객체를 패자가 덮어쓰지 않음**(각자 다른 attemptId). 문서 행 잠금으로 확정은 1회.
- copy 조건부(`CopySourceIfMatch`=tmp ETag)로 검증–copy 사이 임시키 교체(경쟁) 방지. (MinIO/Railway 실동작 검증 필요.)
- **저장소 호출 중 DB 행 잠금 유지 금지**(지연이 커넥션/잠금 고갈로 번지지 않게).

실패 처리표:
| 실패 지점 | 처리 |
|---|---|
| copy 실패/타임아웃 | uploaded 아님. 불명 후보는 정리 대상 |
| 후보 검증 실패 | 해당 페이지 오류 반환(error+retryable), 후보 정리, 남의 확정 덮지 않음 |
| copy 성공·DB 실패 | 후보 고아 가능 → 다음 complete가 새 후보로 복구 |
| DB 커밋·응답 유실 | 재호출 시 기존 확정결과 반환(멱등) |
| DB 커밋·임시키 삭제 실패 | complete 성공 유지, 삭제만 재시도 |
| 동시 complete 패자 | 승자 상태 반환, 자기 후보만 정리 |

### ⑤ 정리(고아) 정책 (Round2)
- 대상: 만료(expiresAt 경과) draft **및** 성공 세션의 삭제 실패 임시키·미채택 후보. (draft만으론 부족)
- 만료 정리와 complete는 **같은 문서 잠금·상태 조건** 사용. 정리 확정 후 complete/reprisign 차단.
- 임시키 삭제해도 유효 PUT URL로 재생성 가능 → **URL 만료+진행중 업로드 유예 후 재정리**.
- 미완료 5개 제한은 **만료 세션 제외**(정리 지연이 사용자 영구 차단 안 되게).
- Railway는 **versioning/ObjectLock/lifecycle 미지원** → 버킷 자동정리 가정 금지, **앱 레벨 정리 잡** 필요(구현은 후속이나 배포 전 최소 실행경로).

### ⑥ 앱 (apps/mobile/src/features/upload — FSD)
- `api/uploadApi`(contracts 타입), `model/useUpload`(presign→PUT→(실패 reprisign)→complete). draftStore에 documentId/pageId/status 보존(복구). `clientRequestId`는 **첫 요청 전 생성·영속**. `분석하기` 연결 + 진행률/실패 UI.

### ⑦ 고려한 대안·트레이드오프
- **A(채택) stateful** vs B(무상태) — Codex: "서버가 진실기준이라 A"는 약한 논거, **업로드 세션 복구가 필요해서 A**가 정확. B도 서명토큰으로 가능하나 복구·고아관리가 애매 → A.
- **불변성**: 짧은 TTL/최종키 쓰기금지만으론 부족 → **후보키 copy 채택**(가장 견고). 버전고정은 Railway 미지원.
- **실패 표현**: `failed_retryable` 영속상태 대신 **complete 응답 error/retryable**(Page는 pending 유지) → 상태전이 최소화(유지보수↑).
- **DocumentsService**: 범용 `transition()` 대신 **구체 메서드**(confirmPages가 확정+완료조건 함께 강제) — 잘못된 전이 원천 차단.
- 크기: **정확 일치**(허용오차 X, 다르면 다른 파일).

### ⑧ 파일·순서 계획
1. contracts(zod) 셋업 + 스키마 → 2. db(Document·Page·enum·마이그레이션 실적용) → 3. documents 모듈(공개 서비스·repository) → 4. uploads 모듈(controller·service·ports/storage·minio adapter) + zod 파이프 → 5. 단위테스트(계약·서비스·동시성/멱등/실패표·가드) → 6. **MinIO 실측**(presign→PUT→complete, 동시/재시도/유실) → 7. 앱 upload feature + 분석하기 연결 → 8. e2e 시나리오(트리거 규칙, 반자동).

### ⑨ 위험
- MinIO/Railway의 **조건부 copy(CopySourceIfMatch)·copy 응답 에러·주소방식** 실동작 검증 필요.
- 동시성 버그(가장 위험) → 문서 잠금·후보키·전체 uploaded 조건 + 집중 테스트로 방어.
- CORS: **RN 네이티브 불필요**(웹 확장 시만) — 문서 정정 완료.

### ⑩ 검증 계획
- 단위: contracts(유효/무효 MIME·크기·페이지수), documents.confirmPages(전체 uploaded만 전이·후퇴 금지·소유권·pageIds 소속·빈/중복/교차), 멱등(UNIQUE·payload 충돌 409), 실패표 케이스, guard.
- 통합/수동(docker MinIO): presign→PUT→complete, **동시 complete·응답 유실·copy후 DB실패·삭제실패·URL만료 재발급**.
- e2e(앱): 분석하기→업로드→완료(반자동, 피커 수동). 시나리오 추가.
- 게이트: `checks.sh` PASS.

### §회의 반영 (Codex 2R 요약)
- R1: 크기/이미지 검증 계약 부재, **원본 불변성(덮어쓰기)**, 세션 재사용/복구 계약 부재, 부분complete/동시성, **도메인 경계 위반**, revision·모델보강·고아정책·상한·**CORS 오해**·Railway 주소방식.
- R2: 후보키 기반 확정(검증객체 자체를 DB 연결)·`CopySourceIfMatch`·copy 응답에러·저장소호출은 DB잠금 밖·**전체 uploaded 조건(pending==0은 버그)**·멱등 UNIQUE+payload 충돌 409·complete 재호출 부분복구·failed는 응답코드로·DocumentsService 구체메서드·정리 대상 확장·Railway versioning 미지원.
- 최종(Codex): **후보키 확정 + 전체 uploaded 조건 + 멱등충돌·만료복구 규칙 반영 시 착수 승인.** → 본 문서에 반영 완료.

### 검증 결과 (VERIFY 후 채움)
- (구현 후 채움)
