# 0019 — 앱 업로드 연동 (presign→PUT→complete)

> **관련 태스크**: #61 (TASK-002 프론트) · **상태**: 구현·실측 완료 — PR 대기 · **유형**: feature (FE)
> **depends**: 백엔드 presign [0018](0018-uploads-presign.md)(#15/PR#59 머지) · 계약 `@clause-lens/contracts` · 촬영 Draft [0001](0001-image-capture-and-draft.md) · [frontend-architecture.md]
> **unblocks**: 분석 요청(TASK-003, #16)
> **product 흐름**: Notion 02 §9 — `분석하기` → presign → 저장소 직접 업로드.

## PRD (왜/무엇)

### 1. 문제
백엔드 presign(#15)은 완료됐지만, 앱은 아직 로컬 Draft를 저장소에 올리지 못한다. `분석하기`가 no-op(`onPress={() => {}}`). 앱이 **presign→각 이미지 직접 PUT→complete**를 오케스트레이션해야 분석(TASK-003)으로 넘어갈 수 있다.

### 2. 목표
- G1. `features/upload` (FSD): `api/uploadApi`(contracts 타입·응답 zod `.parse()`) + `model/useUpload`(오케스트레이션) + `model/uploadStore`(서버 세션 상태).
- G2. `분석하기` → 업로드 흐름 연결. 진행률·부분 실패·재시도 UI.
- G3. 서버가 진실 — 응답을 계약으로 검증, documentId/clientRequestId 보존(멱등·복구).
- G4. iOS/안드로이드 이미지가 **백엔드 MIME 화이트리스트(jpeg/png/webp)** 를 항상 만족(HEIC 정규화).

### 3. 비목표
- **분석 요청·jobId·폴링**(TASK-003) — 업로드 완료까지만. complete 성공 후엔 "업로드 완료" 상태 표시(분석 트리거는 다음).
- 백그라운드 업로드·다중 동시성 튜닝·재개(resumable) — 후속.
- entitlement 차감(TASK-005).
- **(Codex 2R 스코프 축소)** 바이트 진행률·자동 네트워크 재시도/백오프·**앱 재시작 복구**·편집 중 자동 세션 분기 — 첫 슬라이스 제외. 전송은 **순차 + 수동 재시도(단일 재시도 버튼)**, 복구는 **세션 내(인메모리)** 만. `전송 3/5 → 서버 확인 중 → 업로드 완료` 표시(진행률 콜백 생략, 취소용으로 createUploadTask는 유지).
- **cross-restart 복구·세션 조회/포기 API** — 공개 전 후속(서버 24h·미완료 5개 제한 대응). 자동 새 세션 생성으로 회피하지 않음.

### 4. 제약 (Guardrails)
- **토큰·presigned URL·이미지 원문 로그 금지.** 토큰은 `loadSession().accessToken`로만.
- 서버 상태(documentId·pageId·status)와 **로컬 Draft를 혼합 저장 금지** — Draft(`capture`)는 순수 로컬 유지, 서버 세션은 `upload/model/uploadStore`로 분리.
- 응답은 `@clause-lens/contracts` 스키마로 `.parse()`(런타임 안전).
- Expo v57 문서 우선. 네이티브 추가 시 prebuild.

### 5. 사용자 흐름
```
PageList [분석하기] (pages≥1)
  → useUpload.start()
     1) 각 draft 페이지 메타 확보: contentType(정규화 후 image/jpeg)·sizeBytes·width·height
     2) POST /uploads/presign { clientRequestId, pages[] } (JWT)  → { documentId, pages:[{pageId,order,uploadUrl}] }
        · clientRequestId·documentId·(draftId→pageId) 매핑을 uploadStore에 보존(멱등·복구)
     3) 각 이미지 → uploadUrl 로 직접 PUT (expo-file-system uploadAsync, Content-Type)  [진행률/실패 per-page]
        · PUT 403(만료) → POST /uploads/{documentId}/reprisign 로 URL 재발급 후 재시도
     4) POST /uploads/{documentId}/complete { pageIds } (JWT) → { status, pages:[{status,error?,retryable?}] }
        · pending+retryable 페이지는 재-PUT→complete 재호출(멱등)
     5) status=uploaded → "업로드 완료" 상태(분석 요청은 TASK-003)
```

### Acceptance
- [x] `분석하기` → presign→PUT→complete → `uploaded` (시뮬레이터 실측)
- [x] 응답 `.parse()` 검증, 실패 시 재시도/재발급 경로 동작
- [x] documentId·clientRequestId 보존(같은 draft 재시도 시 멱등)
- [x] iOS HEIC 등도 업로드 성공(정규화)
- [x] 단계 상태(idle→presigning→uploading→confirming→uploaded/error) + 부분 실패·단일 재시도 UI
- [x] **취소·로그아웃·계정변경 시 진행 중 업로드 즉시 무효화**(네이티브 task 취소 + 모든 await 후 실행 유효성 검사, 후속 요청 금지)
- [x] **응답 집합 검증**(presign order 정확 일치·complete 요청 pageIds와 결과 집합 일치·documentId 일치 → 불일치=계약오류 중단, URL 재발급으로 숨기지 않음)
- [x] **size_mismatch**: 스냅샷과 실측 다르면 기존 세션 재PUT 금지 → 새 세션/재선택 안내
- [x] **업로드 세션에 ownerUserId+인증세대 바인딩**(다른 사용자 토큰으로 이어지지 않음)
- [x] 단위 테스트(uploadApi·useUpload) + e2e(반자동) · `checks.sh` PASS
- [x] 토큰·URL·이미지 로그 없음(예외·응답본문·상태 스냅샷 포함)

## SDD (어떻게)

### ① 읽은 코드
- `capture/model/{draftStore,types,useImagePicker}`(Draft: localUri·width·height·order, 순수 로컬), `capture/ui/PageList`(`분석하기` no-op), `auth/lib/secureSession`(loadSession→accessToken), `auth/api/authApi`(EXPO_PUBLIC_API_BASE_URL 패턴), `@clause-lens/contracts`(presign/complete 스키마·타입).

### ② 네이티브 의존 추가 (prebuild 필요)
- **`expo-file-system`** — presigned **PUT** 바이너리 업로드(`uploadAsync`, `uploadType: BINARY_CONTENT`, `httpMethod:"PUT"`, `Content-Type` 헤더). 파일 크기 폴백(`getInfoAsync`). (RN fetch의 file:// blob PUT은 불안정 → 채택 안 함.)
- **`expo-image-manipulator`** — **HEIC→JPEG 정규화**. iOS 사진은 흔히 HEIC(`image/heic`)라 백엔드 화이트리스트(jpeg/png/webp) 밖 → 픽 직후 JPEG로 재인코딩해 `contentType=image/jpeg` 보장(매직바이트도 일치). 재인코딩 후 크기 재측정.

### ③ 데이터/상태
- **Draft 확장(로컬 사실만)**: `DraftImageInput`/`DraftPage`에 `contentType`·`sizeBytes` 추가(픽 시 asset.mimeType/fileSize 또는 정규화 결과에서). 서버 개념 아님 → capture에 유지 OK.
- **`upload/model/uploadStore`(신규, 서버 세션)**: `{ clientRequestId, documentId?, phase: idle|uploading|partial|uploaded|error, pages: Record<draftId,{pageId?, status:'pending'|'uploading'|'uploaded'|'failed', error?, retryable?, progress?}> }`. Draft와 **분리**(혼합 저장 금지 준수).
- `clientRequestId`는 업로드 시작 시 1회 생성(`crypto.randomUUID`/expo-crypto)·보존 → 재시도 멱등.

### ④ 코드 계획 (FSD)
- `features/upload/api/uploadApi.ts` — `presign`·`reprisign`·`complete`. base=EXPO_PUBLIC_API_BASE_URL, `Authorization: Bearer ${loadSession().accessToken}`. 응답 `presignResponseSchema.parse()` 등.
- `features/upload/model/useUpload.ts` — 오케스트레이션(위 §5). per-page PUT(expo-file-system) + 재시도/재발급 + complete 멱등.
- `features/upload/model/uploadStore.ts` — 위 상태.
- `features/capture/model/useImagePicker.ts` — 픽 후 **정규화(JPEG)** + sizeBytes/contentType 채움.
- `features/capture/ui/PageList.tsx` — `분석하기` onPress→`useUpload.start()`, phase에 따라 disabled/진행률/완료.
- (선택) `features/upload/ui/UploadStatus.tsx` — 진행/실패/완료 표시. (shared-first: 제네릭 진행바는 packages/ui 후보 — 판단 후.)

### ⑤ 고려한 대안·트레이드오프
- **PUT 방식**: `expo-file-system.uploadAsync`(채택, 바이너리·헤더·안정) vs fetch blob(RN file:// blob 불안정) vs XHR(수동).
- **HEIC**: 정규화(채택, 항상 jpeg 보장) vs 화이트리스트에 heic 추가(백엔드 매직바이트·Vision 호환 복잡) vs 거부(UX 나쁨).
- **메타 출처**: picker asset(fileSize/mimeType) 우선 + 정규화 결과로 확정. 정규화하면 크기/타입이 바뀌므로 **정규화 후 값**을 presign에 보냄(백엔드 크기 정확일치와 일관).
- **상태 위치**: uploadStore 분리(채택) — Draft 순수성 유지(도메인 경계·혼합 저장 금지).

### ⑥ 위험
- 정규화 후 sizeBytes와 실제 PUT 바이트가 어긋나면 백엔드 `size_mismatch` → **정규화 산출 파일을 그대로 PUT**하고 그 파일 크기를 presign에 보냄(동일 파일 보장).
- expo-file-system `uploadAsync` 진행률 콜백/에러 코드 확인(403 만료 판별) — 실측 필요.
- 네이티브 2개 추가 → prebuild·회귀 스모크(기존 화면).

### ⑦ 검증 계획
- 단위: uploadApi(fetch 목·`.parse` 성공/실패), useUpload(presign→PUT→complete 순서·부분 실패 재시도·멱등, api·FileSystem 목).
- e2e(반자동): 로그인→촬영/선택→분석하기→업로드 완료(피커·로그인 수동). 시나리오 추가(트리거 규칙).
- 시뮬레이터 실측: 로컬 API+MinIO 기동, 실제 업로드→DB uploaded 확인.
- 게이트 `checks.sh` PASS.

### §회의 반영 (Codex 2R · 2026-09-22)
착수 승인 조건으로 반영한 결정:

- **전송(P1-1)**: `expo-file-system`(v57 **legacy**) `createUploadTask`로 PUT + **결과 HTTP status 직접 확인**(Promise 완료·null/undefined ≠ 성공). iOS `sessionType: FOREGROUND`. 취소=네이티브 task 취소 + **모든 await 후 실행 유효성 검사**(stale finally가 새 실행 잠금 해제 못 하게). 진행률 콜백은 생략(전송 n/N 표시).
- **스냅샷·파일 수명(P1-2)**: 시작 시 `{draftId,localUri,order,contentType,sizeBytes,width,height}` 스냅샷 확정 + 세션 중 Draft 편집 잠금(재시도 오류 상태에서도 잠금, 명시적 포기 후 편집). 정규화 산출물은 **고유 URI**로 만들고 세션 중 변경/정리 금지. **size_mismatch에서 실측≠스냅샷이면 재PUT 금지**(서버 expectedSize 고정)→새 세션. 크기 같아도 바이트 동일 보장 안 됨.
- **오류 분기(P1-3/4)**: presign 유실→같은 키로 presign 재호출 / complete 유실→같은 pageIds로 **complete부터**(재PUT 금지) / copy_failed→complete 재시도 / not_uploaded→PUT후 complete / size_mismatch→위 규칙 / invalid_image·retryable=false→자동중단+재선택 / **PUT403→제한 재발급 후 재차 403이면 중단**. **결과 불명**(PUT 유실/타임아웃)→중단 후 complete로 확인. **서버 409는 만료·payload충돌·미완료한도초과 공통** → 409로 새 키 생성 금지. 미지 코드/retryable 누락→중단. 재발급·재시도 상한. `expiresAt`(URL) vs `sessionExpiresAt` 별도.
- **응답 집합 검증(P1-6)**: `.parse()`는 대응까지 보장 안 함 → presign order 정확 일치·중복 없음, reprisign은 기존 pageId↔order 유지·요청 외 페이지 없음(빈 배열 허용), complete 요청 pageIds==결과 집합. **빈 reprisign 뒤 complete는 알고 있는 pageIds로 호출**. 불일치=계약오류 중단. HTTP오류 vs 스키마오류 구분. 요청도 `presignRequestSchema.parse`로 검증.
- **인증 바인딩(P1-5·P1-7)**: 세션에 `ownerUserId`+인증세대 묶음. **로그아웃 시작·계정 변경 시(네트워크 실패 무관) 즉시 실행 무효화**. 토큰은 **app 레이어에서 주입**(app이 auth+upload 조합, 호출 직전 소유자·세대 일치 확인 후 토큰 획득, 장기 캡처 금지). FSD: PageList엔 onAnalyze/uploadState props, feature→feature import 제거.
- **상태(P1-5)**: phase `idle|presigning|uploading|confirming|uploaded|error`, 페이지=PUT완료여부 + 서버 pending|uploaded 분리. 부분 실패는 페이지 결과에서 파생. 중복 실행=첫 await 이전 실행 잠금 + runId.
- **스코프(P2)**: 순차 전송·단일 재시도 버튼(미확정만)·세션 내 복구. 제네릭 진행 표시는 shared-first 후보(packages/ui), 업로드 오류·재시도 조합은 feature.

최종(Codex): **5개 P1 보완 반영 조건으로 첫 슬라이스 착수 승인** → 본 문서 반영 완료.

### 검증 결과 (2026-09-23)
- **게이트**: `checks.sh` ✅ ALL PASS(9검사). 단위: mobile upload 10(uploadApi 6·useUpload 4) 포함.
- **시뮬레이터 실측(iPhone 17 Pro + 로컬 API/MinIO/Postgres, prebuild 재빌드, 카카오 로그인 수동)**:
  - 사진 선택→**JPEG 정규화**→`분석하기`→presign→**MinIO 직접 PUT**→complete→**"업로드 완료"** 관측.
  - 백엔드 확인: `Document.status=uploaded`, `Page.status=uploaded`·confirmedAt set, **finalKey=후보키**(`documents/…/r1/{uuid}`).
  - **MinIO 객체 존재**: `size == expectedSize`(1773843), `type=image/jpeg` → 정규화·크기 정확일치·후보키 copy 실동작.
- **단위로 확정(실기기 아님)**: 응답 집합검증(order 불일치→중단), 부분 실패 retryable 반영, 인증 없음→error. 취소·계정변경 무효화·size_mismatch 분기는 코드+로직(실기기 부하/동시성은 후속).
- **정직 표기**: 해피패스·정규화·크기일치는 실기기 관측, 오류/동시성 엣지는 단위 커버. 앱 재시작 복구·자동 백오프는 비목표(후속).
