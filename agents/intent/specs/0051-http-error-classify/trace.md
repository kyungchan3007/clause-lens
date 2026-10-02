# 0051 — 과정 기록 (trace)

## 판단
- **매핑을 상상하지 않고 실제 분기부터 읽음.** 코드 변경 전 세 훅의 status 분기를 1:1로 수집:
  - `useUpload.describeError`: `instanceof HttpError` → `401`="로그인이 필요해요." · `409`="이미 처리 중이거나 만료된 세션이에요…" · 그 외(**403 포함**)·비HttpError="업로드 중 문제가 발생했어요…"(제네릭).
  - `useAnalysis`: `e instanceof HttpError && e.status === 403` → `errorKind:"quota"` + "현재 사용할 수 있는 무료 분석 횟수가 없어요", 아니면 "분석 요청에 실패했어요".
  - `useDocumentReview`: `e instanceof HttpError && e.status === 410` → `removeDocument` + `state="gone"`, 아니면 `state="error"`.
  - → 분류 매핑 확정: `403→quota · 410→gone · 401→auth · 409→conflict · 그 외/비HttpError→unknown`.
- **403의 미묘함.** classifyHttpError는 403을 `quota`로 보지만, useUpload에는 403 전용 문구가 없다(원래 제네릭). 그래서 describeError는 `auth`/`conflict`만 case로 두고 `quota`/`gone`/`unknown`을 **default(제네릭)**으로 떨어뜨려 **기존 403 동작을 그대로** 보존. (useUpload의 403은 전부 아래 `PutHttpError` 경로가 담당 — describeError까지 오는 403은 거의 없고, 와도 제네릭이 원본과 동일.)
- **PutHttpError는 건드리지 않음.** useUpload의 S3 PUT 403(URL 만료 → 1회 재발급)은 `HttpError`가 아니라 로컬 `PutHttpError` 클래스. 전송 계층 재시도 로직이라 분류 대상이 아니며 그대로 유지.
- **문구는 feature 소유.** 분류(quota/gone/auth/conflict/unknown)만 공통으로 올리고, 한국어 문구·errorKind·목록 제거 처리는 각 훅에 남김(대안 B의 문구 통합은 세 feature가 달라 기각).
- **loginError.ts 제외.** mapLoginError는 Supabase 인증 에러(message/code) 매핑이라 HTTP status 체계가 아님 → 대상 아님.
- **미사용 import 정리.** 재배선 후 `HttpError` 직접 참조가 사라진 세 파일에서 import 제거(useUpload는 `../api/uploadApi`에서, useAnalysis는 `../api/analysisApi`에서, useDocumentReview는 `../../../shared/http`에서).

## 막힘 / 되돌림
- 첫 typecheck에서 `@clause-lens/contracts` 모듈 미해결 다수 — 내 변경과 무관(워크스페이스 dist 미빌드). 게이트 순서대로 `contracts` build 선행 후 mobile typecheck 통과(EXIT 0) 확인.
- describeError를 `quota` case까지 전용 문구로 만들 뻔했으나, 원본에 403 전용 문구가 없어 제네릭 유지가 맞음 → default로 되돌림.

## 검증 결과
- mobile typecheck EXIT 0.
- 기존 `useUpload`·`useAnalysis`·`useDocumentReview` 테스트가 **수정 없이 통과** = 동작 불변의 증거.
- 신규 `httpError.test.ts` 1 suite / 6 tests 추가. mobile 테스트 before 37 suites/227 → after 38 suites/233.
- 중복 제거: status→의미 분기 3곳(upload describeError·analysis 403·documents 410)을 공통 `classifyHttpError` 1함수로 단일화.
- `bash agents/harness/evals/checks.sh` 전체 게이트 실행 결과는 커밋 전 최종 확인.
