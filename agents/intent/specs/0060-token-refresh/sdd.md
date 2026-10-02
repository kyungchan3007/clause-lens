# 0060 — 앱 access 토큰 자동 갱신 (SDD)

- **관련 PRD**: 0060-token-refresh/prd.md
- **이슈:** #126
- **상태**: draft
- **설계 토론**: Codex(gpt-6-astra) 2026-10-02 — 결정·대안 근거는 trace.md "설계 토론 결과" 참조.

## 1. 접근 (Approach)
공통 HTTP 계층(`authedGet/authedPost`)에서 **401 → refresh → 1회 재시도**를 수행하고, refresh의 동시성(single-flight)·세션 세대·무효화는 **세션 매니저**가 소유한다. refresh 호출은 래퍼를 거치지 않아(루프 차단) base `fetch`로 한다.

**① 세션 매니저** `features/auth/model/authSession.ts`
- `getAccessToken()`: secureSession에서 현재 access 취득.
- `refreshAccess(prevToken)`: **single-flight**.
  - 이미 in-flight면 그 promise에 합류.
  - 아니면 secureSession 현재 access를 읽어 `prevToken`과 비교 — 다르면(누군가 이미 refresh) **네트워크 없이** 현재 토큰 반환(늦은 401 처리).
  - 같으면 `authApi.refresh(refreshToken)` 호출 → 성공: `saveSession(new)` + 새 access 반환. **확정 인증 실패(refresh 401)**: `clearSession()` + `onAuthLost()` + throw(AUTH_LOST). **일시 장애(네트워크·5xx)**: 세션 **유지**하고 throw(세션 정리 안 함) — Codex 보완.
  - 공유 promise는 `finally`에서 해제.
- 세션 세대/식별자: refresh 성공 저장·무효화 전 현재 세션이 바뀌지 않았는지 확인(로그인/로그아웃 경합 시 이전 요청이 새 세션을 지우지 못하게).
- `onAuthLost` 콜백: authStore가 주입(상태만 초기화, 서버 logout과 분리).

**② 공통 계층 주입** `shared/api/client.ts`
- `configureAuthGateway({ refreshAccess })` — 앱/스토어 초기화 1곳에서 세션 매니저를 주입(shared→features 직접 import 금지).
- `authedGet/authedPost`: 401이고 게이트웨이가 주입돼 있으면 `newToken = await gateway.refreshAccess(usedToken)` → **1회** 재시도. 재시도도 401이면 throw(추가 refresh 없음). 비401·게이트웨이 미주입이면 기존대로 throw.
- **시그니처는 유지**(accessToken 인자) — 호출부 8곳·feature api 무변경(대안 참조).

**③ refresh API** `features/auth/api/authApi.ts`
- `refresh(refreshToken): Promise<AuthResult>` — `POST /auth/refresh`. 401이면 `AuthRefreshRejectedError`(확정 실패), 그 외(네트워크·5xx)는 일반 에러(일시 장애)로 구분.

**④ authStore 연동** `features/auth/model/authStore.ts`
- 초기화 시 `configureAuthGateway(authSession)` + `authSession.setOnAuthLost(() => set({status:"unauthenticated", user:null}))`.
- 서버 logout을 부르는 `signOut()`과 분리(무효화는 로컬 상태만).

## 2. 고려한 대안 (Alternatives)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 배치 | client에 직접 refresh+retry (게이트웨이 주입) | ✅ | 공통 계층 1곳·호출부 무변경(fix 위험↓) |
| | 별도 인증 래퍼 + authedGet(path,schema)로 시그니처 변경(Codex 1안) | ❌(이번) | 이상적이나 8 호출부+feature api+훅 대거 변경 → fix PR엔 과함. **후속 리팩터로 분리** |
| 토큰 결합 | client가 secureSession 직접 read | ❌ | shared→features 결합 |
| | **게이트웨이 주입**(refreshAccess만) | ✅ | 결합 차단·테스트 용이(가짜 주입) |
| single-flight | authStore 보유 | ❌ | store는 UI 상태, 네트워크 동시성 아님 |
| | **세션 매니저 단일 보유** | ✅ | 동시 401 합류·세대 비교(Codex) |
| 실패 정책 | 모든 refresh 실패에 로그아웃 | ❌ | 일시 장애에 과도한 로그아웃 |
| | **확정 인증 실패(refresh 401)만 세션 정리**, 일시 장애는 유지 | ✅ | Codex 보완 — prd G3의 예외로 명시 |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `features/auth/model/authSession.ts`(+테스트), `shared/api/client.test.ts` 확장(또는 신규 refresh 테스트).
- 변경: `shared/api/client.ts`(게이트웨이 주입·401 재시도), `features/auth/api/authApi.ts`(refresh+에러 구분), `features/auth/model/authStore.ts`(주입·onAuthLost 배선), `features/auth/index.ts`(export).
- 호출부 8곳·feature api 모듈: **무변경**(시그니처 유지).
- 앱 전용(apps/mobile). 서버 계약 불변.

## 4. 데이터 / 계약 (Contracts)
- `/auth/refresh` → `AuthResult{accessToken,refreshToken,user}` (서버 기존).
- secureSession 저장 포맷 불변(access·refresh 단일 JSON 원자 저장).
- `HttpError`(status) 전파 계약 불변 — 401 재시도 실패 시 그대로 throw.

## 5. 위험과 완화 (Risks)
- R1 무한 refresh 루프 → 완화: refresh는 base fetch(래퍼 미경유), 원 요청 재시도 예산 1회, 재401은 추가 refresh 없이 throw.
- R2 세션 경합(refresh 중 로그아웃/재로그인) → 완화: 세대/식별자 비교로 이전 요청이 새 세션을 덮어쓰거나 지우지 못하게.
- R3 토큰 로그 유출 → 완화: 토큰·URL 로그 금지 유지, 에러는 status만.
- R4 일시 장애에 과도 로그아웃 → 완화: 확정 인증 실패만 세션 정리.
- R5 게이트웨이 미주입 환경(테스트) → 완화: 미주입이면 기존 동작(throw)로 폴백.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 앱 변경만. 되돌리려면 `configureAuthGateway` 호출·client 401 분기·authSession·authApi.refresh를 revert(시그니처 무변경이라 호출부 영향 없음).

## 7. 검증 (Verification)
- 단위:
  - client: 401→refresh(가짜 게이트웨이)→재시도 성공 / 비401 전파 / 재시도도 401이면 throw / 최대 2회 요청.
  - authSession: single-flight(동시 refresh 1회) / prevToken≠현재면 네트워크 없이 현재 반환 / refresh 401→clear+onAuthLost / 일시 장애→세션 유지 / 세션 경합 시 오삭제 없음.
  - authApi.refresh: 401→AuthRefreshRejectedError, 5xx→일반 에러.
- 통합: `bash agents/harness/evals/checks.sh` ALL PASS.
- (가능 범위) upload 15분 이후 Maestro 실측 — e2e는 남은 기능 포함 일괄 시 수행(현 단계 범위 밖일 수 있음, prd 사유).
