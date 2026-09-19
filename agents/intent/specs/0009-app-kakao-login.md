# 0009 — 앱 카카오 로그인 (화면 + 세션 + e2e)

> **관련 태스크**: #36 · **상태**: draft
> **depends**: #32(백엔드 auth) · 백엔드 spec [0008](0008-auth-social-login.md) · 아키텍처 [frontend-architecture.md](../../context/frontend-architecture.md)
> **unblocks**: `분석하기` 로그인 게이트 · entitlement(무료 3회)
> 협업 회의: Codex 검토 반영(2026-09-19) — "UI보다 네이티브 검증 먼저", 게이트 3상태, `authApi`는 `api/` 세그먼트.

## PRD (왜/무엇)

### 1. 문제
백엔드 auth(#32)는 부팅·`/auth/me` 401·refresh DB 경로까지만 실측됐고 **실제 카카오 계정 로그인 end-to-end가 미검증**. 앱에 로그인 화면·SDK가 없어 백엔드 토대를 실제로 켜지 못함. 앱은 근본적으로 per-user(무료 3회·구독·저장·소유권)라 로그인 없이는 서버 기능을 쓸 수 없음.

### 2. 목표
- G1. 앱 **카카오 네이티브 SDK** 로그인 → **access token** 획득.
- G2. 백엔드 `POST /auth/kakao` 교환 → **우리 JWT(access·refresh)** 를 SecureStore에 저장.
- G3. **세션 복원**(앱 재시작) + **라우트 게이트 3상태**(복원 중 / 비인증 / 인증).
- G4. 기본 **로그아웃**.
- G5. **실제 카카오 토큰으로 앱 e2e** 관측(시뮬레이터).

### 3. 비목표 (후속 분리)
- refresh 자동 회전·동시요청 병합 → 미룰 경우 **만료 시 재로그인**으로 명시.
- entitlement(무료 3회)·구독, `분석하기` 게이트 실제 연결.
- Apple 로그인(iOS 정식 출시 전 4.8 대응).
- 카카오톡 앱 전환 로그인 경로(실기기 몫).

### 4. 제약 (Guardrails)
- 비밀번호 직접 취급 안 함(소셜만). **토큰·PII를 로그에 남기지 않음.**
- 네이티브 앱 키·API base URL = **env 주입**(하드코딩 금지). 단 Native App Key는 앱에 박히는 client-public 식별자 → env는 위생 목적(비밀성 보장 아님).
- **SecureStore 저장 실패 시 로그인 성공 처리 금지**(capture 진입 안 함).
- "토큰 문자열 존재 = 인증"으로 처리 금지 — 게이트는 명시적 상태로 판단.

### Acceptance
- [x] 로그인 화면 렌더 + 카카오 버튼 (dev build 스모크 스크린샷 — iPhone 17 Pro)
- [x] 카카오 로그인 → access token → `POST /auth/kakao` → `{ accessToken, refreshToken, user }` 수신 → SecureStore 저장
- [x] 앱 재시작 시 세션 복원 → 인증 상태면 capture, 아니면 로그인 *(재실행 → `/auth/me` 검증 → capture 실측)*
- [x] 로그아웃 → 저장 토큰 제거 → 로그인 화면 복귀 *(서버 RefreshToken 폐기 0건 확인)*
- [x] **앱 e2e**: 로그인 탭 → 카카오 로그인 → JWT 저장 → capture 진입 *(실 카카오 계정 통과 — DB에 User(displayName=실프로필)·RefreshToken 생성)*
- [x] 기존 화면(Capture·Skia·SVG·reanimated) 회귀 없음(네이티브 리빌드 후 스모크)
- [x] `checks.sh` PASS(6/6) · 토큰·PII 로그 없음
- 정직 표기: 시뮬레이터에 카카오 세션이 있어 로그인 창 없이 토큰 통과. **카카오톡 앱 전환/실기기 웹 로그인 콜백은 후속 실기기 검증**.

### 구현 중 발견·수정
- tailwind `content`에 `./src/**` 누락 → FSD 피처의 className 미생성(숨은 버그). 추가로 capture 아이콘 배경 등도 정상화.

---

## SDD (어떻게)

### 1. 읽은 문서
백엔드 spec `0008`, `frontend-architecture.md`(FSD·zod 계약 흐름), `architecture.md`(상태 모델), `@react-native-kakao` 공식 문서(Expo 설치·login API).

### 2. 결정: 순서 — 네이티브 검증 선행 (Codex 회의)
UI 구현 전에 네이티브 리스크를 제거한다. `기준선 스모크 → SDK+config plugin 추가 → prebuild diff → 네이티브 빌드 → 기존 화면 회귀 스모크 → 실 카카오 토큰 획득` 후 UI 연결.

### 3. 라이브러리 (조건부 확정)
`@react-native-kakao/core` + `@react-native-kakao/user` + Expo config plugin.
- **버전 고정 후 실제 빌드 통과로 확정** — Expo 57 / RN 0.86 조합은 라이브러리 문서로 확정 불가.
- config plugin 핵심: iOS `handleKakaoOpenUrl`(URL 스킴 `kakao{NATIVE_APP_KEY}`) · Android auth activity. **expo-router가 생성한 AppDelegate의 URL 처리와 공존 확인**.
- 카카오 콘솔: iOS 플랫폼(`com.chan.clauselens`) 등록 저장 + 동의항목(닉네임) 활성화.

### 4. 모듈 구조 (FSD — frontend-architecture 준수)
```
apps/mobile/src/features/auth/
  ui/LoginScreen.tsx        카카오 버튼 + 상태 표시(로딩/에러)
  model/authStore.ts        zustand — 세션 상태(복원중/비인증/인증) + user
  model/useKakaoLogin.ts    카카오 SDK 호출 → access token → 서버 교환 오케스트레이션
  api/authApi.ts            POST /auth/kakao·refresh·logout (shared/api client 사용)
  lib/secureSession.ts      SecureStore 읽기/쓰기/삭제(백엔드 access·refresh)
  index.ts
apps/mobile/app/
  _layout.tsx               게이트 3상태로 login/capture 분기(복원 중 스플래시)
  login.tsx                 라우트(얇게) → LoginScreen
```
- **`authApi`는 `api/` 세그먼트**(FSD: api는 레이어가 아닌 세그먼트). 응답은 가능하면 `packages/contracts` zod로 검증(후속에서 계약 공유).
- 서버 상태 캐시(TanStack Query)는 이 태스크 범위 밖 — 세션은 zustand + SecureStore로 충분.

### 5. 저장·세션 모델
- SecureStore 키: 백엔드 `accessToken`·`refreshToken`(**카카오 토큰과 구분해 저장하지 않음** — 카카오 토큰은 교환 후 폐기).
- 게이트 상태: `restoring`(부팅 시 SecureStore 조회) → 토큰 있으면 `authenticated`, 없으면 `unauthenticated`. 저장 실패 → `unauthenticated` 유지 + 에러 표시.
- 만료 처리(이 태스크): access 만료 시 재로그인 유도(refresh 자동화는 후속).

### 6. 환경 변수 (앱)
- `EXPO_PUBLIC_API_BASE_URL`(로컬 e2e = `http://localhost:3000`) · 네이티브 앱 키는 app config plugin에 env로 주입.
- 실제 키 값은 카카오 콘솔·env 참조(문서·코드에 값 미기재).

### 7. 위험 · 완화
- R1: 카카오 라이브러리 57/0.86 미호환 → 빌드 실패. **완화**: 버전 고정 + 선행 빌드 검증, 안 되면 대안 라이브러리·plugin 재검토(태스크 내 확정).
- R2: prebuild가 기존 네이티브(Skia·SVG·reanimated) 깨뜨림. **완화**: 기준선 스모크 → diff 확인 → 리빌드 후 회귀 스모크. `--clean`은 수동 네이티브 변경 확인 후.
- R3: 시뮬레이터에서 카카오계정 웹 로그인 콜백 복귀 실패. **완화**: `login({ useKakaoAccountLogin: true })` 우선 검증. 막히면 REST OAuth 수동 토큰으로 **백엔드 통합만** 검증(앱 e2e로 계산 안 함) + 실기기 후속.
- R4: 토큰 로그 유출. **완화**: 토큰·프로필 원문 로그 금지(guardrail).

### 8. 검증 계획
- 선행: 기준선·리빌드 후 시뮬레이터 스모크(iOS Simulator 도구) + 실 카카오 토큰 획득 로그(값 미기재).
- 본: 로그인 e2e(시뮬레이터) — 로컬 백엔드 + docker Postgres 기동 필요.
- `checks.sh`(typecheck·expo-doctor 등) PASS.

### 9. 후속(이 태스크 밖)
- refresh 자동 회전·동시요청 병합, entitlement(무료 3회), `분석하기` 게이트 연결, Apple 로그인, 카카오톡 앱 전환 경로(실기기).
