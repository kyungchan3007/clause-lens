# 0060 — 앱 access 토큰 자동 갱신(401→refresh→재시도) (PRD)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-02
- **이슈:** #126

## 1. 문제 (Problem)
앱에 access 토큰 **자동 갱신이 없다.**
- 서버 `POST /auth/refresh`(`auth.service.refresh`)는 있으나 **앱이 호출하지 않음.**
- `authStore.ts`는 만료·검증 실패 시 바로 재로그인 유도("refresh 자동화는 후속" 주석).
- 공통 HTTP 클라이언트 `client.ts`는 401에 그냥 `throw HttpError(status)` — 재발급·재시도 없음.
- 결과: access TTL 15분 경과 후 API 호출(업로드 등) → 401 → "로그인이 필요해요" → 강제 로그아웃. `authedGet/Post` 호출부 8곳 전부 노출. #123 Maestro upload 시나리오에서 재현.
- **기록 정정**: 이슈 #126의 완료조건 중 `공통 HTTP 계층 401→refresh→재시도`가 체크돼 있으나 **구현·spec·PR·커밋 어디에도 없음** → 거짓 체크. 본 작업에서 실제 구현 후 정정.

## 2. 목표 (Goals)
- G1. 401 수신 시 refresh 토큰으로 access 재발급 → 원 요청 **1회 재시도**.
- G2. 동시 다발 401에서 refresh는 **1회로 합류**(single-flight, 중복 refresh 방지).
- G3. refresh 실패(만료·폐기)일 때만 세션 정리 + 로그인 유도.
- G4. 공통 HTTP 계층 한 곳에서 처리 — 8개 호출부가 공유.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 리프레시 토큰 회전(rotation)·이전 세션 토큰 폐기 자체(서버 정책) — 서버는 현 동작 유지, 앱은 받은 새 토큰 저장만.
- N2. #76 결과 격리 세션 하드닝(별도 이슈).
- N3. 토큰 선제 갱신(만료 전 미리 refresh) — 이번은 401 반응형만.

## 4. 사용자 흐름 (User Flow)
- 로그인 후 15분 경과 → 업로드/분석/폴링 등 호출 → 401 → (앱이 조용히 refresh → 재시도) → 성공, 사용자는 끊김 없음.
- refresh도 실패 → 세션 정리 + 로그인 화면(이때만 재로그인).

## 5. 성공 지표 (Success Metrics)
- 단위 테스트: 401→refresh→재시도 성공 / refresh 실패→세션 정리 / 동시 401 refresh 단일화.
- upload 시나리오 15분 이후 실측에서 강제 로그아웃 없이 성공(가능 범위).
- `bash agents/harness/evals/checks.sh` ALL PASS.

## 6. 제약 (Constraints)
- 앱(apps/mobile)만. 서버 계약(`/auth/refresh` → AuthResult) 불변.
- guardrail: 토큰·URL 로그 금지. 토큰 장기 캡처 금지(호출 직전 취득).
- 세션은 `secureSession`(access·refresh 단일 JSON) 원자적 저장 유지.
- 설계 확정은 **Codex 설계 토론 후**(메모리 규칙) — 근거 sdd 기록.

## 7. 미해결 질문 (Open Questions) — Codex 설계 토론에서 확정
- Q1. refresh+retry를 **어디에** 둘까: `client.ts` 직접 vs 세션 소유 래퍼/인터셉터 레이어(현재 client는 accessToken을 인자로만 받음).
- Q2. single-flight 공유 refresh promise를 **어느 모듈**이 보유(세션 매니저 vs authStore).
- Q3. 재시도 토큰 주입: client가 secureSession을 직접 읽을지(결합) vs 주입된 토큰 공급자.
- Q4. refresh 실패 시 authStore 연동(signOut/status) 방식과 무한 루프 차단(refresh 자체 401·재시도 후 재401).

### Acceptance
- [x] Codex 설계 토론으로 배치·동시성 설계 확정, 근거를 sdd에 기록
- [x] 공통 HTTP 계층에서 401 → refresh → 재시도(1회) 처리 (client.ts 게이트웨이 주입)
- [x] 동시 401 refresh 단일화(single-flight) (authSession 공유 promise)
- [x] refresh 실패 시 세션 정리 + 로그인 화면 (확정 인증 실패만 정리, 일시 장애는 세션 유지 — sdd 보완)
- [ ] 단위 테스트 + (가능 범위) upload 시나리오 15분 이후 실측 (단위 완료 / Maestro 15분 실측은 e2e 일괄 단계에서 — 현 단계 범위 밖)
- [x] 이슈 #126의 거짓 체크(첫 완료조건) 정정 — 실제 구현으로 충족, 머지 시 issue-sync로 이슈 반영
