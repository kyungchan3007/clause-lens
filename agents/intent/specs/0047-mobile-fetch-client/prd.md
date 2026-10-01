# PRD — 모바일 공통 authed fetch 클라이언트

> **이슈:** #134 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
`apps/mobile`의 5개 기능 api(`auth·analysis·upload·documents·entitlement`)가 서버 호출 보일러플레이트를 각자 복붙하고 있다.

- `const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL` + `baseUrl()`(누락 시 throw)가 **5중복**.
- `Authorization: Bearer ${token}` 헤더 + `if(!res.ok) throw new HttpError(res.status)` + `schema.parse(await res.json())` 패턴이 **엔드포인트마다 복제**(Authorization 8중복).
- `uploadApi.ts`가 `HttpError`를 **로컬에서 재정의**해, 동일 이름의 클래스가 `shared/http.ts`와 2개 존재한다. 소비자(useUpload)의 `instanceof` 분기가 "어느 HttpError냐"에 의존하는 잠재적 취약점.

같은 로직이 흩어져 있어, 헤더·에러 처리 방식을 바꾸려면 N군데를 손대야 하고 drift 위험이 있다.

## 2. 목표 (Goals)
- G1. 공통 authed fetch 클라이언트(`src/shared/api/client.ts`)로 `baseUrl`·`authedGet`·`authedPost`를 단일화.
- G2. 5개 기능 api가 **경로+스키마만 선언**하도록 재배선. baseUrl 5중복·Authorization 중복 제거.
- G3. `HttpError`를 `shared/http.ts` **단일 클래스**로 통일(uploadApi 로컬 정의 제거). `instanceof` 분기가 단일 클래스로 일관 동작.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 외부 동작(경로·메서드·헤더·에러 status 분기·스키마 파싱 결과) 변경 — **동작 완전 불변**.
- N2. SSE(`openStatusStream`, `react-native-sse`) 변경 — 그대로 유지.
- N3. auth의 커스텀 에러 메시지·무스키마 반환 동작 변경 — 보존(공유 contracts 미도입 상태라 클라이언트의 schema 강제와 불일치).
- N4. S3 PUT 전용 `PutHttpError`(useUpload) 변경 — 범위 밖.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(내부 리팩토링). 로그인·업로드·분석·재열람·자격조회 화면 동작은 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(mobile 타입·유닛 테스트 포함, before=after).
- api 파일에서 baseUrl/Authorization/HttpError 보일러플레이트 LOC 감소, 중복 클래스 0.

## 6. 제약 (Constraints)
Expo v57, 서버가 진실의 기준(프론트는 표현만). → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. auth api의 `@clause-lens/contracts` zod 계약 도입 시 `authedGet`으로 완전 흡수 가능 — 후속(#별도).

### Acceptance
- [x] `src/shared/api/client.ts` 신설: `baseUrl()`·`authedGet(path, token, schema)`·`authedPost(path, token, body, schema)`.
- [x] `analysis·upload·documents·entitlement` api가 클라이언트를 사용(경로+스키마만 선언).
- [x] `auth` api가 공통 `baseUrl()`을 사용(baseUrl 5중복 제거).
- [x] `uploadApi.ts`의 로컬 `HttpError` 제거 → `shared/http.ts`로 단일화(import/re-export).
- [x] 각 엔드포인트 경로·메서드·헤더·에러 status 분기·스키마 파싱 동작 완전 동일.
- [x] SSE(openStatusStream) 유지.
- [x] client 단위 테스트 추가.
- [x] `bash agents/harness/evals/checks.sh` PASS.
