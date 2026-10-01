# 0047 — 과정 기록 (trace)

## 판단
- **동작 불변이 최우선.** 코드 변경 전 5개 api의 호출 형태를 1:1로 대조:
  - `baseUrl()`: 5개 파일 모두 `const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL` + 누락 시 동일 메시지 throw. → client로 단일화.
  - authed GET: entitlement·documents(2)·analysis.fetchStatus 는 `{ Authorization: Bearer }`만, Content-Type 없음 → `authedGet`.
  - authed POST(바디 있음): upload presign/reprisign/complete 는 `Content-Type + Authorization` + JSON 바디 → `authedPost(..., body, schema)`.
  - **analysis.requestAnalysis 는 바디·Content-Type 없는 POST**(Authorization만). 이걸 발견해서 authedPost에 `body === undefined` 분기를 둬야 헤더가 완전히 동일해진다. (안 그러면 없던 Content-Type이 붙어 불변 위반.)
- **auth는 흡수하지 않음.** `loginWithKakao`/`fetchMe`/`logout`은 (1) 커스텀 Korean Error 메시지(`카카오 로그인 실패 (401)` 등, HttpError 아님), (2) zod 스키마 없이 `as` 캐스팅, (3) loginWithKakao/logout은 Authorization 미사용. client의 `authedGet/Post`(HttpError throw + schema.parse 강제)로 바꾸면 에러 타입·파싱 동작이 바뀐다 → **baseUrl만 공유**하고 fetch 본문은 보존. auth 테스트의 `fetchMe` 헤더가 정확히 `{ Authorization: "Bearer access" }`라서 더더욱 그대로 둬야 함.
- **HttpError 단일화.** uploadApi가 로컬 `class HttpError`를 따로 갖고 있어, useUpload의 `instanceof HttpError`가 "uploadApi의 것"에 묶여 있었다. client가 `shared/http.ts`의 HttpError를 throw하고, uploadApi·analysisApi가 그걸 re-export하도록 통일 → 소비자 import 경로(`../api/uploadApi`, `../api/analysisApi`, `shared/http`) 셋 다 동일 클래스를 가리킴. 기존 테스트가 `toBeInstanceOf(HttpError)`로 이미 이걸 검증.
- **schema 타입.** client를 zod에 직접 의존시키지 않으려고 `{ parse(data: unknown): T }` 구조적 타입 사용. contracts의 zod 스키마가 자연히 들어맞음.

## 막힘 / 되돌림
- (기록 강제 훅) 코드 수정 전 spec 폴더(prd·sdd·trace) 선행 필요 → 0047 폴더부터 작성 후 코드 착수.
- `requestAnalysis` 바디 분기: 처음엔 authedPost를 upload 기준(항상 Content-Type)으로 짰다가, requestAnalysis의 원본에 Content-Type이 없음을 확인하고 `body === undefined` 분기로 되돌림(헤더 불변).

## 검증 결과
- `bash agents/harness/evals/checks.sh` **ALL PASS**(전체 체크). mobile 유닛 34 suites / 211 tests 통과.
- 기존 api 테스트(auth·analysis·upload·documents·entitlement)가 수정 없이 그대로 통과 = 동작 불변의 증거(URL·method·Authorization 헤더·HttpError status·zod 파싱 모두 동일). before=after.
- 신규 `client.test.ts` 1 suite / 7 tests 추가(baseUrl·authedGet·authedPost 바디 유무 분기·HttpError·schema.parse). mobile 테스트 before 33 suites/204 → after 34 suites/211.
- 중복 제거: baseUrl 5→1(client), authed 호출 보일러플레이트(Authorization+!ok→HttpError+schema.parse) 8엔드포인트를 authedGet/authedPost 2함수로, HttpError 클래스 2→1(uploadApi 로컬 정의 삭제).
