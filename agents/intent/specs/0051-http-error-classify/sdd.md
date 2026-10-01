# SDD — HTTP status→의미 분류(classifyHttpError) 공통화

> **관련 PRD:** 0051-http-error-classify/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"분류(status→의미)는 공통으로, 문구·처리는 feature에" 원칙의 재배선. 각 feature가 복붙하던 `e instanceof HttpError && e.status === N`를 **순수 함수 1개**로 모으되, 그 결과를 사용자 문구/errorKind/처리로 바꾸는 부분은 feature에 그대로 둔다.

- **신규 `src/shared/lib/httpError.ts`** — `classifyHttpError(e: unknown): HttpErrorKind`
  - `HttpErrorKind = "quota" | "gone" | "auth" | "conflict" | "unknown"`.
  - `HttpError`(shared/http.ts) 아니면 즉시 `unknown`(네트워크·스키마 오류 등 fallback).
  - status 매핑: `403→quota` · `410→gone` · `401→auth` · `409→conflict` · 그 외 `unknown`.
  - 매핑은 **각 feature의 실제 분기를 먼저 읽고** 맞춤: 403은 useAnalysis의 무료 소진, 410은 useDocumentReview의 보관 경과, 401/409는 useUpload describeError의 두 분기.
- **재배선 — useUpload.describeError** (문구 feature 소유)
  - `switch (classifyHttpError(e))`: `auth`→"로그인이 필요해요." · `conflict`→"이미 처리 중…" · `default`→제네릭.
  - 원본은 `instanceof HttpError`일 때 401/409만 전용, 나머지(403 포함)·비HttpError는 제네릭. → `quota`/`gone`/`unknown`이 모두 `default`로 떨어져 **동일**.
  - `PutHttpError`(S3 PUT 403 재발급)는 `HttpError`가 아닌 별도 클래스라 **그대로 유지**(분류 대상 아님).
- **재배선 — useAnalysis** (errorKind·문구 feature 소유)
  - `const isQuota = e instanceof HttpError && e.status === 403` → `classifyHttpError(e) === "quota"`.
  - 이후 `message`·`errorKind: isQuota ? "quota" : undefined` **그대로**.
- **재배선 — useDocumentReview** (처리 feature 소유)
  - `e instanceof HttpError && e.status === 410` → `classifyHttpError(e) === "gone"`.
  - `removeDocument` + `setState("gone")` 분기 **그대로**.
- **loginError.ts 미변경** — Supabase 인증 에러(message/code) 매핑이라 HTTP status 체계가 아님.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 순수 함수 `classifyHttpError(e)→kind`, 문구·처리는 feature 유지 | 분류만 단일화, 문구 소유권 보존, 테스트 쉬움, 동작 불변 | 없음(범위 적정) | ✅ |
| B. `classifyHttpError` + `kind→문구` 맵까지 공통화 | 문구도 단일 | upload/analysis/documents 문구·처리가 서로 달라 억지 통합 → PRD N1(문구 feature 소유) 위반, 불변 리스크 ↑ | ❌ |
| C. `HttpError`에 `kind` getter 추가 | 호출 짧음 | shared/http.ts 비대·의미(quota 등 도메인 색채)를 전송 계층에 섞음, 비HttpError fallback 별도 처리 필요 | ❌ |
| D. 각 feature에 분기 존치(현행 유지) | 변경 0 | drift·중복 그대로 — 리팩토링 목적 미달 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `apps/mobile/src/shared/lib/httpError.ts`, `apps/mobile/src/shared/lib/httpError.test.ts`.
- 수정: `apps/mobile/src/features/upload/model/useUpload.ts`(describeError + import), `.../analysis/model/useAnalysis.ts`(isQuota + import), `.../documents/model/useDocumentReview.ts`(gone + import).
- 새 의존성: 없음(순수 TS, `shared/http.ts`의 `HttpError`만 참조). Expo 무관.
- 미변경: `loginError.ts`, `shared/http.ts`, `PutHttpError`.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 변화 없음. `HttpError` 스키마 불변. **BFF 트리거 체크**: 해당 없음(새 API/외부 연동 아님).

## 5. 위험과 완화 (Risks)
- R1 매핑을 잘못 맞추면 문구/처리가 바뀜 → 완화: 각 feature 실제 분기를 먼저 대조(403=analysis·410=documents·401/409=upload), 403이 upload에서 제네릭으로 떨어지는지까지 확인.
- R2 useUpload의 `PutHttpError` 403을 분류로 끌어가면 S3 URL 재발급 경로가 깨짐 → 완화: HttpError 아닌 별도 클래스라 분류 비대상, 그대로 유지.
- R3 비HttpError(네트워크) fallback 변동 → 완화: `classifyHttpError`가 비HttpError를 `unknown`으로 반환 → 각 feature default/제네릭과 동일.
- R4 사용하지 않게 된 `HttpError` import 잔존으로 타입 에러 → 완화: 세 파일에서 미사용 import 제거.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 내부 재배선 → 문제 시 revert.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — mobile typecheck + 유닛 테스트(기존 useUpload·useAnalysis·useDocumentReview 테스트가 동작 불변의 증거).
- 신규 `httpError.test.ts`: 403→quota·410→gone·401→auth·409→conflict·그 외 status→unknown·비HttpError(Error/문자열/undefined/null)→unknown.
