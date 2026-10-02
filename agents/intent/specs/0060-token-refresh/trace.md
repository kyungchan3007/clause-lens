# 0060 — 토큰 자동 갱신 (TRACE · 판단 로그)

- **이슈:** #126

## 2026-10-02

### 착수 · 사전 조사
- 현황 확인(코드):
  - `shared/api/client.ts`: `authedGet/Post`가 accessToken을 **인자로** 받고 `!res.ok`면 `throw HttpError(status)`. refresh/retry 없음. 호출부 8곳.
  - `features/auth/model/authStore.ts:38`: "refresh 자동화는 후속" — 미구현.
  - `features/auth/api/authApi.ts`: loginWithKakao·fetchMe·logout만, **refresh 함수 없음**(서버 `/auth/refresh`는 존재).
  - `features/auth/lib/secureSession.ts`: load/save/clear, access·refresh 단일 JSON 원자 저장.
- **기록 정정 발견**: 이슈 #126 완료조건 중 "공통 HTTP 계층 401→refresh→재시도"가 체크돼 있으나 spec·PR·커밋 어디에도 구현 없음 → 거짓 체크. 본 작업 완료 시 정정.
- 선행: #155 머지로 request.md 요구(0059~) 적용 → 0060도 `pnpm request 126`로 원문 고정(dogfood 성공).

### 설계 토론(Codex) — 착수 전 필수(메모리 규칙)
- 결정 4항목 질의(백그라운드): ① refresh+retry 배치(client 직접 vs 세션 래퍼) ② 토큰 주입·결합·호출부 시그니처 ③ single-flight 보유 위치 ④ 실패·루프 차단·authStore 연동.
- 결과는 받는 대로 sdd 접근·대안에 근거와 함께 반영.

### 설계 토론 결과(Codex, gpt-6-astra)
- **배치**: client는 전송·HttpError만, 인증 래퍼가 토큰취득→요청→401 refresh→1회 재시도. refresh는 재시도 없는 base client로(루프 차단).
- **토큰 결합**: client가 secureSession 직접 read 금지 → 세션 매니저 주입. (Codex는 공개 API를 authedGet(path,schema)로 바꿔 8 호출부에서 토큰 제거 권장.)
- **single-flight**: 세션 매니저가 공유 refreshPromise 보유(finally 해제). 세대 비교로 "이미 refresh 끝난 뒤 늦게 온 구토큰 401"은 네트워크 없이 최신 토큰으로 재시도. 재401은 추가 refresh 없이 무효화. 세션 식별자로 경합(로그인/로그아웃) 시 오삭제 방지.
- **실패·루프·store**: 매니저가 무효화 + onSessionInvalidated 콜백으로 authStore status 초기화(서버 logout 부르는 signOut과 분리). 원 요청 재시도 예산 1회. 비401 전파.
- **실패 정책 보완(Codex)**: prd G3은 "refresh 실패 시 정리"로 넓게 썼으나, 권장은 **확정 인증 실패(refresh 토큰 거부=401)만 세션 정리, 일시 장애(네트워크·5xx)는 세션 유지**. → sdd에 예외 명시.

### 내 확정(= Codex 핵심 채택 + fix 위험 조정)
- 세션 매니저 single-flight·세대·무효화·실패 정책·루프 차단은 **그대로 채택**.
- **단, 공개 API 시그니처는 유지**(authedGet(path, accessToken, schema)). 이유: 8 호출부+feature api+훅 대거 변경은 fix PR엔 과함. refresh+retry를 client 내부에 게이트웨이 주입으로 넣어 **호출부 무변경**. 스테일 토큰 우려는 401 재시도+세대 비교로 해소. Codex의 "토큰 인자 제거" 전면 리팩터는 **후속**으로 분리(sdd 대안표).

### 구현 기록
- `shared/api/client.ts`: `configureAuthGateway`·`AuthGateway` 추가, `sendWithRefresh`로 401 시 1회 재시도(게이트웨이 미주입이면 기존 throw). 시그니처 유지.
- `features/auth/api/authApi.ts`: `refresh(refreshToken)` + `AuthRefreshRejectedError`(401/403=확정 거부, 그 외=일시 장애).
- `features/auth/model/authSession.ts`(신규): single-flight(`refreshPromise`), 세대 비교(prev≠현재면 네트워크 없이 현재), 확정 실패만 clear+onAuthLost, 일시 장애는 세션 유지, refreshToken으로 경합(로그인/로그아웃) 오삭제 방지.
- `features/auth/model/authStore.ts`: 생성 후 `configureAuthGateway({refreshAccess})` + `setOnAuthLost(→ status unauthenticated)` 배선. restore 주석 갱신.
- 테스트: client 401 재시도 5케이스 / authSession 7케이스(single-flight·세대·실패 정책·경합) / authApi.refresh 3케이스. 전부 PASS.
- 게이트: `checks.sh` ALL PASS(mobile typecheck+jest 포함).
- 루프 차단 확인: refresh는 authApi(base fetch)로 호출 — authedGet/Post(래퍼) 미경유. 재시도 예산 1회.
- #126 거짓 체크: 첫 완료조건이 구현 없이 [x]였음 → 실제 구현으로 충족. 머지 시 issue-sync가 0060 prd Acceptance를 이슈에 반영.
