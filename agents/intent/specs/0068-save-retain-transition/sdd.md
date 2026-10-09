# SDD — 분석 결과 장기 보관 전환(저장하기)

- **관련 PRD**: 0068-save-retain-transition/prd.md
- **이슈:** #163 · **의존:** #162 · **설계 근거**: ADR-12 · ADR-06 · 적대적 리뷰(2026-10-09)
- **상태**: approved (적대적 리뷰 Q1~Q6 반영)

## 1. 접근 방식 (Approach)
결과 재열람 수명을 **보관 상태(analysis status와 직교한 축)로** 표현한다. `Document`에 `retentionState`(TEMPORARY|SAVED) + `savedAt`를 더하고, 상세(410)·목록·저장이 **하나의 순수 판정 함수**를 공유한다. 저장은 **멱등 조건부 UPDATE(CAS)** 로 TEMPORARY→SAVED만 수행(서버가 소유권·완료·미만료·구독 보관 권한 검증). **보관 권한은 저장 시점에 포착(write-time capture)** 하고 SAVED는 그 뒤 **영속 권리(durable grant)** — 읽기 게이트는 구독을 재확인하지 않는다. DELETING·실삭제·구독 만료 취소는 전부 **#164**.

> **⚠️ 출시 경계:** SAVED를 되돌리는(취소·만료) 경로는 #164에만 있다. #163 단독으론 SAVED가 불멸이다. 실사용상 `canSaveDocuments`는 구독 행이 없어 #165 전까지 항상 false → 아무도 저장 불가. **그러므로 #163은 #164+#165가 모두 랜딩할 때까지 사실상 비활성이며, 저장 UI 기능 플래그는 #164 전까지 OFF로 유지한다.**

**① 데이터 모델** (`packages/db/prisma/schema.prisma` + 마이그레이션)
- `enum RetentionState { TEMPORARY SAVED }` — **DELETING은 #163에서 넣지 않는다**(#164가 enum 값 추가 + 취소 모델 결정). 리뷰 P1: #163이 #164 모델을 선점하지 않음.
- `Document.retentionState RetentionState @default(TEMPORARY)` · `Document.savedAt DateTime? @db.Timestamptz(3)`(감사용 메타 — **가시성은 savedAt에서 파생하지 않는다**).
- 기존 행은 기본 TEMPORARY(백필 불필요·안전). `retainUntil` 유지(TEMPORARY 유효 기한). SAVED 유효 기한은 상태로 계산.
- 인덱스: 새 목록 술어는 기존 `[userId, retainUntil, completedAt]` 레인지를 못 쓴다(OR·SAVED의 과거 retainUntil). per-user 규모라 `userId` prefix 스캔으로 충분 → **인덱스 신설은 측정 후**(P2, 선추가 안 함).

**② 순수 판정 함수** (`packages/db/src/documents-ops.ts`, 시계 주입)
- `documentVisible(doc: {retentionState, retainUntil}, now)`:
  - `SAVED` → true
  - `TEMPORARY` → `isRetentionActive(retainUntil, now)`(기존 재사용)
  - **그 외(미래의 DELETING 등) → false (default-deny)** — #164가 DELETING 추가해도 전방 안전.
- `canTransitionToSaved(doc: {status, retentionState, retainUntil}, now)`(순수): `status∈{done,partial} AND retentionState='TEMPORARY' AND isRetentionActive(retainUntil, now) AND retainUntil!=null`. (이미 SAVED는 멱등 분기로 호출측 처리.)
- **terminal 불변식(가정, 테스트로 고정):** `status∈{done,partial}` ⟺ `completedAt`·`retainUntil` 둘 다 세팅(동일 원자 쓰기). 이게 깨지면 "상세엔 보이는데 저장은 거부"(null retainUntil) 이음새 발생 → parity/invariant 테스트로 차단.

**③ 저장 API** (`apps/api` documents 모듈 + `packages/contracts`)
- `POST /me/documents/:id/save` (인증 필요, 멱등). **UPDATE가 단일 권위, pre-load는 에러코드 산출용(advisory).**
- 조건부 UPDATE(DB `now()` 기준): `SET retentionState='SAVED', savedAt=now() WHERE id=? AND userId=? AND retentionState='TEMPORARY' AND retainUntil>now()`.
- **savedAt 멱등:** 가드가 `retentionState='TEMPORARY'`라 두 번째 저장은 0행 → savedAt 덮어쓰기 없음. READ COMMITTED로 충분(Serializable 불필요).
- **0행 응답 결정표**(bare rowcount로 분기 금지 — 존재 누출 방지):

  | 단계 | 결과 | 응답 |
  | --- | --- | --- |
  | pre-load `findOwnedSession` miss | 소유 아님 | **404** |
  | 권한 `canSaveDocuments(subs)` false | 미구독 | **403**(구독 안내 바디 코드) |
  | UPDATE 1행 | 전환 성공 | **200** |
  | 0행 + 재조회 SAVED | 멱등 | **200** |
  | 0행 + 재조회 TEMPORARY·retainUntil≤now | 만료 | **410** |
  | 0행 + 재조회 미완료(status∉done,partial) | 미완료 | **409** |
  | 0행 + 재조회 기타(미래 DELETING 등) | 차단 | **409/410** |

  순서: pre-load(404) → 권한(403) → UPDATE → 0행이면 재조회로 분기. 권한은 UPDATE 전 검사하되 UPDATE 가드를 대체하지 않음(사이 만료는 UPDATE가 0행으로 포착).

**④ 목록·상세 게이트** — `documentVisible` 공유
- 상세 410 게이트: `getAnalysis`의 `isRetentionActive(doc.retainUntil)` → `documentVisible(doc, now)`로 교체. **owner-404를 가시성보다 먼저**(비소유자가 상태 구분 못 하게). **동작 변경:** 과거 retainUntil인 SAVED 문서가 기존 410 → 200으로 바뀜(의도, trace 명시).
- 목록 쿼리: `status IN(done,partial) AND (retentionState='SAVED' OR (retainUntil IS NOT NULL AND retainUntil>now()))`. (목록은 추가로 status·retainUntil NOT NULL을 요구 → 진행중 문서는 상세엔 보여도 목록 제외: 의도된 발산, parity 테스트로 고정.)

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 보관 상태 = 신규 enum(retentionState, TEMPORARY/SAVED만) | lifecycle status와 직교·전방 안전 | 컬럼 1개 | ✅ |
| 기존 status에 saved 추가 | 컬럼 無 | 두 상태머신 혼재·모든 `status IN(done,partial)` 술어 오염 | ❌ |
| savedAt 유무로 가시성 파생 | 최소 스키마 | DELETING 표현 불가·#164 tombstone과 충돌(savedAt=null인데 비가시) | ❌(savedAt은 감사 전용) |
| DELETING을 #163에서 enum에 포함 | 마이그레이션 1회 | #164의 취소 모델(상태 vs 작업레코드) 선점 | ❌(→ #164, default-deny로 전방 대비) |
| retainUntil 먼 미래로 연장 | 함수 변경 최소 | "날짜 반복 기록 안 함" 위배·만료 재계산난 | ❌ |
| SAVED 게이트에서 구독 재확인 | 즉시 차단 | 진실 소스 이중화·#164 권한과 드리프트 | ❌(write-time capture + durable grant) |

## 3. 영향받는 코드 (Touched Surface)
- `packages/db/prisma/schema.prisma`(+마이그레이션): RetentionState(TEMPORARY/SAVED)·Document 2필드.
- `packages/db/src/documents-ops.ts`: `documentVisible`·`canTransitionToSaved`·목록 쿼리 · `index.ts` 재노출.
- `apps/api .../documents`: 저장 컨트롤러/서비스/레포(조건부 UPDATE + 재조회 분기), `getAnalysis` 게이트 교체, 목록 매퍼(savedAt·retentionState 노출).
- `packages/contracts`: 저장 응답/에러코드 스키마 + 목록 DTO에 `retentionState`·`savedAt?`(optional, 하위호환).
- 앱: 결과 화면 저장하기 버튼(**기능 플래그 OFF 기본**)·성공 시 목록 재조회.
- 새 의존성 없음.

## 4. 데이터 / 계약 (Contracts)
- `POST /me/documents/:id/save` → 200(요약) / 거부 403(구독)·410(만료)·409(미완료)·404(소유 아님). 바디 코드(zod)로 분기. 미구독 코드 = **403**(402는 클라 오동작 많음·#162 access 표면과 일관).
- 목록 DTO: `retentionState`·`savedAt?` 추가(앱: "저장됨" 표시, "N일 후 삭제"는 TEMPORARY만). optional → 구버전 앱 하위호환.
- **BFF 트리거 체크**: 다른 클라이언트·다중 서비스·계약 분기 모두 NO → NestJS 엔드포인트로 해결.

## 5. 위험과 완화 (Risks)
- R1 더블탭/동시 저장 → `retentionState='TEMPORARY'` 가드 CAS 1행 보장·savedAt 덮어쓰기 없음(READ COMMITTED). 
- R2 **#163 단독 비활성** → SAVED 취소 경로 없음. 플래그 OFF 유지·#164+#165 후 활성(§1 경계).
- R3 null-retainUntil 이음새(상세 보임·저장 거부) → terminal 불변식 테스트로 차단(done|partial ⟺ completedAt·retainUntil 원자 세팅).
- R4 `documentVisible`(TS) ↔ 목록 SQL 이중언어 드리프트 → (status×retentionState×retainUntil) 매트릭스 parity 테스트.
- R5 clock skew(app pre-check vs DB UPDATE) → 보관 비교의 권위는 **DB now()**(UPDATE). pre-check는 advisory. 게이트 읽기는 요청시각(기존 유지), 수 ms 차는 UPDATE가 흡수.
- R6 앱 구버전이 새 DTO 필드 모름 → optional 추가로 하위호환.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 마이그레이션(기본 TEMPORARY) + 코드. **저장 UI 기능 플래그는 #164 전까지 OFF.** 서버 `canSaveDocuments` 검사가 실제 보안 경계(플래그는 UI 전용) — 플래그 OFF여도 /save는 권한 검사로 방어(테스트로 고정).
- 되돌리기: 게이트를 `isRetentionActive`로 복귀 + 저장 엔드포인트 비활성(마이그레이션은 기본값이라 데이터 안전).
- **#164에 넘기는 제약(명시):** ① DELETING 비가역(DELETING→SAVED 금지) ② 30일 유예 완전 경과 후에만 DELETING 진입(재구독이 DELETING으로 레이스 안 되게) ③ DB에서 `Page.finalKey` 열거 후 Document 행 삭제(랜덤 UUID 키 복구 불가) ④ #164가 유일한 취소 권위.

## 7. 검증 (Verification)
- 단위: `documentVisible`(SAVED·TEMPORARY×만료 경계·unknown default-deny), `canTransitionToSaved`(완료·미만료·상태·null), 저장 레포 CAS 멱등(fake tx), 저장 서비스 결정표(미소유 404·미구독 403·만료 410·미완료 409·이미 SAVED 200).
- 통합: `packages/db/test/recall.integration.mjs` 확장 — (status×retentionState×retainUntil) 매트릭스로 상세 게이트 ↔ 목록 SQL **parity** + terminal 불변식.
- `bash agents/harness/evals/checks.sh` ALL PASS(prisma validate·api/db 단위).
- 수동: 시드로 SAVED가 retainUntil 경과 후에도 목록·상세 노출 / TEMPORARY는 기존대로 만료.
