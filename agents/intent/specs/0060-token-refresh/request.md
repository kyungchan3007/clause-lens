<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #126

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/126
- 캡처: 2026-10-02

---
### 문제 현상
- 앱에 access 토큰 자동 갱신 부재 — 서버 `POST /auth/refresh`(apps/api auth.controller)는 존재하나 앱 미사용
- access TTL 15분 경과 후 API 호출(업로드 등) 401 → "로그인이 필요해요." → 재실행 시 로그아웃 상태
- 근거: `apps/mobile/src/features/auth/model/authStore.ts` "만료·검증 실패 → 재로그인 유도(refresh 자동화는 후속)" 주석

### 재현 방법
- 로그인 후 15분 이상 경과 → 계약서 담기 → 분석하기 → 업로드 단계에서 401
- #123(PR #125) Maestro upload 시나리오 1차 실측에서 재현

### 기대 동작
- 401 수신 시 refresh 토큰으로 access 재발급 → 원 요청 1회 재시도
- refresh 실패(만료·폐기) 시에만 재로그인 유도
- 동시 다발 401 시 refresh 1회로 합류(중복 refresh 방지)

### 영향 범위
- 업로드·분석 요청·폴링·최근 목록·잔량 조회 등 인증 API 전반
- 실사용: 장시간 앱 사용 중 업로드 도중 강제 로그아웃 위험
- e2e: 15분 이상 걸리는 Maestro 실행에서 인증 만료로 시나리오 중단(플래키)

### 심각도
- High

### 완료 조건
- [x] 공통 HTTP 계층에서 401 → refresh → 재시도(1회) 처리
- [ ] 동시 401 refresh 단일화
- [ ] refresh 실패 시 세션 정리 + 로그인 화면
- [ ] 단위 테스트 + upload 시나리오 15분 이후 실측
