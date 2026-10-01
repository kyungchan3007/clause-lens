# SDD — 모바일 공통 authed fetch 클라이언트

> **관련 PRD:** 0047-mobile-fetch-client/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"로직은 그대로, 출처만 공통 클라이언트로" 원칙의 재배선(rewire). 각 api는 **경로·스키마·바디만** 선언하고, 네트워크/헤더/에러/파싱은 클라이언트가 담당한다.

- **신규 `src/shared/api/client.ts`**
  - `baseUrl()`: `process.env.EXPO_PUBLIC_API_BASE_URL`(모듈 로드 시 1회 캡처) — 누락 시 기존과 **동일 메시지**로 throw.
  - `authedGet<T>(path, token, schema)`: `fetch(baseUrl()+path, { headers: { Authorization: Bearer } })` → `!ok → throw new HttpError(status)` → `schema.parse(await res.json())`.
  - `authedPost<T>(path, token, body, schema)`: `method: POST`. **바디 유무로 헤더 분기** — `body !== undefined`면 `Content-Type: application/json` + `body: JSON.stringify(body)`(upload 계열과 동일), `body === undefined`면 Authorization만(analysis `requestAnalysis`의 바디·Content-Type 없는 POST와 동일). 이후 `!ok → HttpError`, `schema.parse`.
  - `HttpError`는 `shared/http.ts`에서 import 후 **re-export**(소비자가 client 경유로도 접근 가능).
  - schema 타입은 구조적 타입 `{ parse(data: unknown): T }`로 선언 → zod 의존을 client에 직접 들이지 않고 contracts zod 스키마와 호환.
- **재배선**
  - `entitlement`/`documents`: GET들을 `authedGet(path, token, schema)`로 치환. documents의 `?cursor=` 쿼리는 path에 포함.
  - `analysis`: `fetchStatus`→`authedGet`, `requestAnalysis`→`authedPost(path, token, undefined, schema)`(바디 없는 POST 보존). `openStatusStream`(SSE)·`HttpError` re-export는 유지.
  - `upload`: 로컬 `HttpError`·`baseUrl`·내부 `authedPost` 헬퍼 **삭제**, `shared/http.ts` HttpError를 re-export. `presign`은 기존대로 요청을 먼저 `presignRequestSchema.parse` 후 `authedPost(..., parsed, presignResponseSchema)`.
  - `auth`: 로컬 `API_BASE_URL`/`baseUrl` 삭제하고 client의 `baseUrl` import(5중복 제거). 단, `loginWithKakao`·`fetchMe`·`logout`는 커스텀 Error 메시지·무스키마 반환이라 `authedGet/Post`로 흡수하지 않고 fetch 본문 유지(동작 보존).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 공통 client(baseUrl+authedGet/Post) 재배선, auth는 baseUrl만 공유 | 중복 최대 제거 + 동작 완전 보존 | authedPost 바디 분기 1개 필요 | ✅ |
| B. auth `fetchMe`도 authedGet으로 통일 | 통일도 ↑ | 에러 타입(Error→HttpError)·스키마 강제가 바뀜 → 동작 변경(불변 위반) | ❌ |
| C. requestAnalysis를 inline 유지(바디 분기 안 둠) | client 단순 | analysis에 baseUrl/Authorization 중복 잔존(목표 미달) | ❌ |
| D. authedPost가 항상 Content-Type 세팅 | 분기 없음 | requestAnalysis에 없던 헤더 추가 = 헤더 불변 위반 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `apps/mobile/src/shared/api/client.ts`, `apps/mobile/src/shared/api/client.test.ts`.
- 수정: `apps/mobile/src/features/{auth,analysis,upload,documents,entitlement}/api/*.ts`.
- 새 의존성: 없음(zod 직접 의존 안 함, 구조적 타입 사용). Expo 무관.
- 상태: 서버 호출 공통 경로를 `shared/api/client.ts`로 단일화.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 shape 변화 없음. 각 엔드포인트 경로·메서드·헤더·바디·에러 status·zod 스키마 파싱 **완전 동일**. **BFF 트리거 체크**: 해당 없음(새 API/외부 연동 아님).

## 5. 위험과 완화 (Risks)
- R1 `requestAnalysis`에 Content-Type/바디가 실수로 붙으면 헤더 불변 깨짐 → 완화: authedPost가 `body === undefined`일 때 Authorization만 세팅(테스트로 method·헤더 검증).
- R2 `HttpError` 통일로 `instanceof` 분기가 깨짐 → 완화: client가 `shared/http.ts` HttpError를 throw, uploadApi·analysisApi가 동일 클래스를 re-export → useUpload/useAnalysis/useDocumentReview 전부 단일 클래스 기준. 기존 테스트(`toBeInstanceOf(HttpError)`)로 확인.
- R3 upload 요청 스키마 선검증 순서 변화 → 완화: `presign`에서 parse→authedPost 순서 유지(테스트 "빈 pages → fetch 안 함").

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 내부 재배선이라 데이터·마이그레이션 영향 없음 → 문제 시 revert.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — mobile typecheck + 유닛 테스트(기존 api 테스트가 동작 불변의 증거, before=after).
- 신규 `client.test.ts`: authedGet/authedPost의 URL·메서드·Authorization·HttpError·schema.parse, authedPost 바디 유무 분기, baseUrl 누락 throw 검증.
