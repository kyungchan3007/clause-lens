# 0013 — 로그인 실패 친화 문구 매핑

> **관련 태스크**: #49 · **상태**: in-progress
> **depends**: 로그인 화면 [0009](0009-app-kakao-login.md) · 아키텍처 [frontend-architecture.md](../../context/frontend-architecture.md)
> **why now**: e2e 시나리오(S16)를 쓰려다 드러난 UX 공백 — 실제 동작을 먼저 만들고 그 위에 시나리오를 얹는다.

## PRD (왜/무엇)

### 1. 문제
`LoginScreen`이 로그인 실패 시 `catch`의 `e.message`를 **그대로** 노출한다. 그래서:
- 백엔드 다운/네트워크 오류 → `"Network request failed"`, 서버 5xx → `"카카오 로그인 실패 (500)"` 같은 **개발자용 원문**이 사용자에게 보인다.
- **사용자가 카카오 로그인을 취소**해도 에러 문구가 뜬다(취소는 실패가 아님).

### 2. 목표
- G1. 실패 원인을 **사용자 친화 문구**로 매핑(네트워크 / 그 외 실패).
- G2. **사용자 취소는 문구 미표시**(조용히 로그인 화면 유지).
- G3. 매핑은 **순수 함수**로 분리 → 단위 테스트로 고정.

### 3. 비목표
- 세분화된 서버 에러 코드별 문구(예: 계정 정지) — 서버 계약이 생기면 후속.
- 재시도 백오프·토스트 UI 등 — 지금은 기존 인라인 텍스트 자리 유지.

### 4. 제약 (Guardrails)
- **원문 메시지·토큰·프로필을 로그로 남기지 않는다**(기존 guardrail 유지). 매핑 함수는 로깅하지 않음.
- 서버가 진실 — 프론트는 표현만. 문구는 원인 분류 표시일 뿐 판단 아님.

### Acceptance
- [x] 네트워크 오류(`fetch` 실패) → `"네트워크 연결을 확인해주세요"`
- [x] 서버/기타 실패 → `"로그인에 실패했어요. 잠시 후 다시 시도해주세요"`
- [x] 사용자 취소 → 문구 미표시(`error === null`), 로그인 화면 유지
- [x] 실패 후 Capture 미진입·재시도 가능
- [x] 단위 테스트(매핑 4케이스) + e2e(S16) 작성·실행 · `checks.sh` PASS

## SDD (어떻게)

### ① 읽은 문서/코드
- `useKakaoLogin.ts`(현재 `setError(e.message ?? "로그인에 실패했어요")`), `LoginScreen.tsx`(error를 danger 텍스트로 렌더), `authApi.ts`(서버 오류 시 `Error("카카오 로그인 실패 (status)")` throw, `fetch` 네트워크 실패는 `TypeError("Network request failed")`).
- `@react-native-kakao/user` `login()`은 사용자 취소 시 code를 가진 에러를 throw.

### ② 접근
`lib/loginError.ts`에 **순수 매핑 함수** `mapLoginError(e: unknown): string | null` 추가:
- 취소(코드 `E_CANCELLED_OPERATION`/`CANCELLED`, 또는 message에 `cancel`/`취소`) → `null`.
- 네트워크(`TypeError` 또는 message에 `Network request failed`/`network`) → 네트워크 문구.
- 그 외(서버 5xx·env 누락·알 수 없음) → 일반 실패 문구.
`useKakaoLogin`은 `setError(mapLoginError(e))`로 위임. `error: string | null` 타입 그대로.

### ③ 고려한 대안·트레이드오프
- **A. LoginScreen에서 인라인 분기** — UI에 로직 섞임, 테스트 어려움. ✗
- **B(채택). lib 순수 함수 + 훅에서 호출** — UI/디바이스 분리, 단위 테스트 쉬움. FSD lib 세그먼트에 부합. ✓
- **C. 서버가 에러 코드 표준화 후 코드별 매핑** — 가장 정확하나 서버 계약 선행 필요 → 지금은 과함. 비목표로 미룸.
- 취소 판별을 message 문자열에 의존하는 건 SDK 버전 변화에 취약 → **code 우선, message는 보조**로 이중화.

### ④ 파일·순서 계획
1. `apps/mobile/src/features/auth/lib/loginError.ts` (신규, 순수 함수)
2. `apps/mobile/src/features/auth/lib/loginError.test.ts` (신규, 4케이스)
3. `useKakaoLogin.ts` 수정 — `mapLoginError` 사용
4. `.maestro/SCENARIOS.md` S16 추가 + `.maestro/login-failure.yaml`(반자동: 백엔드 다운)
5. `checks.sh` 게이트

### ⑤ 위험
- 취소 코드 문자열이 SDK 실제 값과 다를 수 있음 → code/message 이중 판별로 완화, 최악의 경우 일반 실패 문구(치명적 아님).
- e2e는 백엔드 다운 + 수동 카카오라 완전 자동 아님 → 반자동으로 명시.

### ⑥ 검증 계획
- 단위: cancel(code)→null, cancel(message)→null, network→네트워크문구, server/unknown→일반문구.
- e2e: 백엔드 내린 상태에서 로그인 시도 → 친화 문구 노출 + "카카오로 시작하기" 유지 + Capture 미진입.
- 게이트: `checks.sh` PASS.

### 검증 결과 (VERIFY 후 채움)
- **단위**: `lib/loginError.test.ts` 4 describe·8 assert PASS — 취소(code)→null, 취소(message)→null, 네트워크→네트워크문구, 서버/env누락/문자열/undefined→일반문구. 원문 미노출 확인.
- **게이트**: `checks.sh` ✅ ALL PASS (mobile 단위 5스위트/26테스트, api 4/19).
- **e2e(S16)**: `login-failure.yaml` 작성. **반자동** — 백엔드 다운 + 카카오 자격증명 수동이 필요해 자동 실행 불가. 실제 노출 확인은 사용자 수동 로그인 시점에 관측(로그인 웹뷰 통과 후 "네트워크 연결을 확인해주세요" 노출 + 로그인 화면 유지). 매핑 로직 자체는 단위 테스트가 완전 커버.
- **정직 표기**: 화면 노출 e2e는 백엔드 기동 상태 제어가 필요해 CI 완전 자동 아님(로그인 자격증명 수동과 동일 한계).
