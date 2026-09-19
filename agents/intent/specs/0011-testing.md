# 0011 — 테스트: 전 기능 단위 테스트 + e2e 시나리오

> **관련 태스크**: #41 · **상태**: draft
> **depends**: #32(백엔드 auth)·#36(앱 로그인)·#38(프로필)

## PRD (왜/무엇)

### 1. 문제
테스트 인프라가 전무(jest·테스트 0). 회귀 안전망이 없어 리팩터/기능 추가 시 파손을 조기에 못 잡음.

### 2. 목표
- G1. api·mobile에 **단위 테스트 인프라** 구축 + `test` 스크립트.
- G2. 현재 기능(인증·프로필)의 **핵심 로직 단위 테스트**.
- G3. 화면 흐름 **e2e 시나리오 문서 + Maestro 플로우**.
- G4. **완료 게이트(checks.sh)에 테스트 편입**.

### 3. 비목표
- 컴포넌트 렌더 테스트(FaqSection/ProfileScreen) — 네이티브(svg/skia) 목 비용 큼 → e2e(Maestro)로 커버.
- 카카오 로그인 자격증명 자동화(수동). CI 자동 실행(#22).

### Acceptance
- [x] `pnpm --filter @clause-lens/api test` GREEN (19)
- [x] `pnpm --filter @clause-lens/mobile test` GREEN (22)
- [x] e2e 시나리오 문서 + Maestro 플로우 5개
- [x] `checks.sh`에 Unit tests(api·mobile) 편입 → 8검사 PASS

---

## SDD (어떻게)

### 1. api (Jest + ts-jest + @nestjs/testing)
- `jest.config.js`(rootDir src, `*.spec.ts`, ts-jest → `tsconfig.spec.json`).
- `tsconfig.spec.json`: `types:["node","jest"]`(빌드 tsconfig는 `**/*.spec.ts` exclude로 분리).
- 대상: TokenService·AuthService(prisma/verifier/tokens 목)·KakaoVerifier(fetch 목)·JwtAuthGuard(ctx 목).

### 2. mobile (jest-expo + @testing-library/react-native)
- `jest.config.js`(preset jest-expo, `*.test.ts(x)`, `resetMocks`).
- **transformIgnorePatterns는 pnpm `.pnpm` 인식**(스코프는 `@scope+name@ver` 인코딩) 단일 패턴으로 RN/Expo/nativewind/zustand/skia/@clause-lens 트랜스파일.
- `jest.setup.js`에서 `EXPO_PUBLIC_API_BASE_URL` 기본값.
- 빌드 tsconfig는 `**/*.test.ts(x)` exclude.
- 대상: secureSession(expo-secure-store 목)·authApi(fetch 목)·authStore(authApi·secureSession 목)·faq.

### 3. e2e (Maestro)
- `apps/mobile/.maestro/`: `SCENARIOS.md`(S1~S8) + `capture-gate·login·session-restore·profile·logout.yaml`.
- 실행: maestro CLI + 로컬 백엔드/docker + dev build. 카카오 자격증명 수동.

### 4. 게이트
- `checks.sh`에 `Unit tests (api)`·`Unit tests (mobile)` 추가(총 8검사).

### 5. 함정·해결
- ts-jest jest 전역 → spec 전용 tsconfig / 빌드 tsconfig에서 테스트 exclude.
- jest-expo + pnpm 트랜스폼 → `.pnpm` 인식 transformIgnorePatterns.
- `clearMocks`(호출만) 대신 `resetMocks`(구현까지) — mock 누수 방지.
- 증분 설치 후 nativewind className 타입 깨짐 → `pnpm install` 재정합.

### 6. 후속
- 컴포넌트/스냅샷 테스트, #22 CI에서 checks.sh(test 포함) 자동 실행, 카카오 e2e 자동화(테스트 계정·딥링크).
