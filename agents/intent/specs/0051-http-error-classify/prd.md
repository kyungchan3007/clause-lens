# PRD — HTTP status→의미 분류(classifyHttpError) 공통화

> **이슈:** #143 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
`apps/mobile`의 여러 feature 훅이 **동일한 `HttpError` status→의미 분기**를 각자 복붙하고 있다.

- `useUpload.describeError`: `e instanceof HttpError` → `status === 401`·`409` 분기.
- `useAnalysis`: `e instanceof HttpError && e.status === 403` (무료 소진 판정).
- `useDocumentReview`: `e instanceof HttpError && e.status === 410` (보관 경과 판정).

같은 "status 숫자 ↔ 의미" 매핑이 세 파일에 흩어져 있어, 새 status 의미를 추가하거나 매핑을 바꾸려면 여러 파일을 동시에 손봐야 하고 drift 위험이 있다. 반면 **사용자에게 보여줄 문구·후속 처리(errorKind·목록 제거 등)는 feature마다 다르다**(upload 문구 ≠ analysis 문구 ≠ documents 처리).

## 2. 목표 (Goals)
- G1. 공통 `src/shared/lib/httpError.ts`(`classifyHttpError(e): "quota"|"gone"|"auth"|"conflict"|"unknown"`)로 status→의미 분류를 단일화.
- G2. 세 훅이 분류 결과로 분기/문구 조회하도록 재배선 — 중복 `instanceof HttpError && status===N` 제거.
- G3. **사용자 문구(한국어)·errorKind·후속 처리는 각 feature에 유지**(분류만 공통).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 외부 동작 변경 — 각 feature의 status→처리·문구·errorKind **완전 불변**(HttpError 아닌 에러 fallback 포함).
- N2. `loginError.ts`(mapLoginError) 변경 — Supabase 인증 에러 매핑으로 HTTP status 체계가 아니므로 대상 아님.
- N3. `useUpload`의 `PutHttpError`(S3 PUT 403 URL 만료 재발급) 변경 — `HttpError`가 아닌 별도 클래스라 분류 대상 아님, 그대로 유지.
- N4. `HttpError` 클래스(`shared/http.ts`) 스키마 변경.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 업로드 실패 문구·분석 무료 소진 전용 화면·재열람 보관 경과 처리 모두 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(mobile 타입·유닛 테스트 포함).
- 기존 `useUpload`/`useAnalysis`/`useDocumentReview` 테스트가 **무수정 통과**(동작 불변의 증거).
- status 분류 중복 3곳 → 공통 1함수.

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. 장기적으로 feature별 문구를 `kind→문구` 맵으로 더 끌어올릴 수 있으나, 문구는 feature 소유 원칙상 보류(후속 검토).

### Acceptance
- [x] `src/shared/lib/httpError.ts` 신설: `classifyHttpError(e)` → `quota`(403)·`gone`(410)·`auth`(401)·`conflict`(409)·`unknown`(그 외·비HttpError).
- [x] `useUpload.describeError`가 classify 결과(auth/conflict)로 문구 분기 — 기존 401/409 문구 동일, 그 외 제네릭 동일.
- [x] `useAnalysis`가 classify 결과(quota)로 errorKind/문구 분기 — 403→quota 동일.
- [x] `useDocumentReview`가 classify 결과(gone)로 처리 분기 — 410→목록 제거+gone 동일.
- [x] 사용자 문구·errorKind·후속 처리는 각 feature 유지(분류만 공통).
- [x] `loginError.ts` 미변경.
- [x] classifyHttpError 단위 테스트 추가.
- [x] 기존 useUpload/useAnalysis/useDocumentReview 테스트 무수정 통과.
- [x] `bash agents/harness/evals/checks.sh` PASS.
