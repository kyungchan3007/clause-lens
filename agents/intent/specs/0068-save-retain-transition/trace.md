# 0068 — 분석 결과 장기 보관 전환(저장하기) (TRACE)

- **이슈:** #163 · **의존:** #162 · **다음:** #164(실삭제)

## 2026-10-09

### 착수
- TASK-006 ② 보관 전환. develop 최신화(#178 머지 지점) → 이슈 #163에서 `feat/163-save-retain` 분기·연결.
- 원문 고정: `pnpm request 163` → request.md(불변, 557자).

### 현행 매핑 (Explore)
- `Document`: completedAt(1회)·retainUntil(=completedAt+7일, 1회·연장없음). **savedAt·보관상태 필드 없음.**
- 순수함수 `isRetentionActive(retainUntil, now)`(`packages/db/src/documents-ops.ts:138`): null→true(진행중), 아니면 미래면 true. 소유자 체크는 호출측.
- 410 게이트: `documents.service.ts getAnalysis()` 소유자(404)→isRetentionActive(410)→job(404).
- 목록(`documents-ops.ts listRecentDocuments`): `status IN(done,partial) AND retainUntil>now`.
- `canSaveDocuments(subs, now)`(`subscription-ops.ts`)=active|grace 구독 하나라도 있으면 true. `GET /me/access.storage.canSave`.
- S3 키: tmp `tmp/{userId}/{docId}/{pageId}`, 원본 finalKey=`documents/{docId}/pages/{pageId}/r{rev}/{randomUUID}`(DB에서만 앎), 정규화 `.../normalized.jpg`. OCR는 DB(PageOcr). DB cascade·S3 수동. 삭제잡·cron 전무.

### 설계 토론 (2026-10-09)
- Codex exec(v0.154)가 프롬프트만 에코하고 응답 미출력(2회) → 메모리 폴백대로 서브에이전트 적대적 리뷰로 전환.
- 제안 설계(검토 중): retentionState enum{TEMPORARY,SAVED,DELETING}+savedAt / 공유 `documentVisible(doc,now)` / 목록 쿼리 SAVED 포함 / 멱등 저장 API(조건부 UPDATE) / SAVED 게이트는 구독 재확인 없이 노출(유예는 #164). 리뷰 Q1~Q6 반영 후 SDD 확정 예정.

### 적대적 리뷰 결론 반영 (서브에이전트, 코드 대조 완료)
- **DELETING을 #163에서 제외** → enum은 `{TEMPORARY, SAVED}`만. `documentVisible`은 **default-deny**(미래 DELETING 전방 안전). #164가 취소 모델(상태 vs 작업레코드) 스스로 결정 — #163이 선점 안 함.
- **0행 응답 결정표**: bare rowcount로 분기 금지(존재 누출). owner 404 먼저 → 권한 403 → UPDATE → 0행이면 재조회로 410(만료)/409(미완료)/200(이미 SAVED) 분기. UPDATE가 단일 권위, pre-load는 에러코드용.
- **#163 단독 비활성 명시**: SAVED 취소 경로가 #164에만 있음 + `canSaveDocuments`는 #165 전까지 false → 저장 UI 플래그 **OFF 유지**(#164 랜딩까지).
- **동작 변경**: 상세 게이트 `isRetentionActive`→`documentVisible` 교체 → 과거 retainUntil인 SAVED가 410→200(의도).
- 미구독 코드 **403**(402 클라 오동작). 보관 비교 권위=**DB now()**. savedAt은 감사 전용(가시성 파생 금지).
- **terminal 불변식**(done|partial ⟺ completedAt·retainUntil 원자 세팅) + **parity 테스트**(documentVisible↔목록SQL, status×retentionState×retainUntil) 추가.
- #164에 넘길 제약: DELETING 비가역·유예 완전경과 후 진입·Page.finalKey 열거 후 행 삭제·#164가 유일 취소 권위.
- (KEEP) write-time capture·durable grant·게이트 구독 재확인 안 함·enum 직교·computed expiry(크론 불요)·CAS READ COMMITTED·strict `>`·기본 TEMPORARY.

### 구현 진행
- 시작: 마이그레이션 → 순수 함수+단위 → 저장 API(결정표) → 게이트/목록 교체 → parity/invariant 테스트 → 앱 저장하기(플래그 OFF) → checks.sh.

### 백엔드 구현 완료 (2026-10-09)
- **스키마**: `enum RetentionState{TEMPORARY,SAVED}`(DELETING은 #164) + `Document.retentionState @default(TEMPORARY)`·`savedAt`. 마이그레이션 `20261009000000_add_document_retention_state`(백필 불필요). prisma validate PASS.
- **순수 함수**(documents-ops): `documentVisible`(SAVED→true·TEMPORARY→isRetentionActive·unknown→default-deny)·`canTransitionToSaved`. 상세·목록·저장 공유.
- **목록 쿼리**: SAVED 포함(`retentionState='SAVED' OR retainUntil>now()`), DTO에 retentionState·savedAt(optional). DB now() 기준.
- **저장 API** `POST /me/documents/:id/save`(멱등): 레포 `saveDocumentCas`($executeRaw CAS, TEMPORARY 가드)·`userCanSave`(getAnalysisAccess). 서비스 결정표(404→이미SAVED 200→403→CAS 1행 200→0행 재조회 분기 409/410/200). 상세 게이트 `isRetentionActive`→`documentVisible` 교체(SAVED 만료 410→200).
- **단위**: retention-visibility(15)·save 결정표(8)·mapper SAVED·recall SAVED 통과 — api jest **15 스위트·112 통과**. 기존 analysis/recall/mapper 스펙 makeDoc에 retentionState 기본 보강.
- **통합(DB gate 밖)**: recall.integration.mjs에 SAVED 가시성 + documentVisible↔목록SQL parity 추가. **Docker 데몬 꺼져 있어 live 미실행** — 백엔드 기동 시 `migrate deploy` + 통합 테스트 함께 검증 예정.
- terminal 불변식은 기존 reaggregateAndBump(completedAt·retainUntil 원자 UPDATE)로 충족 — parity 테스트가 교차 확인.

### 앱 구현 완료 (2026-10-09)
- `documentsApi.saveDocument`(POST /me/documents/:id/save, 바디 없음) + 단위(경로·인코딩·403). 목록 DTO 테스트 fixtures에 retentionState·savedAt 보강.
- `useSaveDocument` 훅: getAccessToken→saveDocument→성공 시 documentsStore.refresh(목록 반영). 거부 분류(403 subscription·410 expired·409 conflict·기타 error) + 훅 단위 7건.
- 기능 플래그 `SAVE_DOCUMENT_ENABLED=false`(shared/config) — #164+#165 전까지 OFF(리뷰 경고). 서버 canSaveDocuments가 실제 경계.
- `ResultScreen`에 optional `onSave`/`saving` prop + 저장 버튼(onSave 주입 시만 노출). app/result.tsx `SaveableResult`가 플래그 ON일 때만 onSave 주입 + Alert 피드백(live·review 양 경로).
- 모바일 typecheck PASS, 모바일 저장 단위 15건 PASS.

### 완료 게이트
- `bash agents/harness/evals/checks.sh` **✅ ALL PASS — 완료 선언 가능**(빌드·typecheck·prisma validate·contracts/infra/api/worker/mobile/ui 단위·harness).
- e2e(maestro): 저장 버튼이 플래그 OFF로 비노출 → 자동화 미대상. 플래그 ON(=#164/#165 랜딩) 시 시나리오 추가 — SCENARIOS.md에 명시.

### 남음
- 커밋(3섹션)·푸시·PR(#163). #164(실삭제)는 이 브랜치 위 스택(스키마 retentionState 의존) — DELETING enum 추가는 #164.
