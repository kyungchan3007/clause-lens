# 0041 — 홈 분석 세션 로직 커스텀 훅 분리 — SDD

> **관련 PRD**: prd.md · **이슈:** #118 · **갱신**: 2026-10-02

## 0. 읽은 문서
- frontend-architecture(레이어·세그먼트·import 경계: 같은 레이어 슬라이스 교차 금지 → 상위에서 조합)
- loop.md(§4 spec 선행·§테스트 필수), branch-and-issue.md

## 1. 접근
```
src/widgets/home-session/
  index.ts                         public API
  lib/mergeSessionPhase.ts         순수 함수: 업로드+분석 → 표시 상태(SessionView)
  lib/mergeSessionPhase.test.ts
  model/useAnalysisSession.ts      세션 훅: 구독·effect·액션
  model/useAnalysisSession.test.ts
  model/useHomeOnboarding.ts       온보딩 판정(draft 0 & 최근 ready & 0건)
```
- `useAnalysisSession()` 반환: `{ hasPages, view, documentId, actions: { analyze, cancel, retry, reset, confirmHome } }`
  - `view` = `mergeSessionPhase(...)` 결과(`phase`·`sentCount`·`totalCount`·`message`).
  - `confirmHome` = Alert 확인 후 `reset`(기존 onHome).
- `app/index.tsx`: 두 훅 호출 + 렌더 + `router.push`(profile·recent·result)만.
- 기존 로직은 **그대로 이동**(effect 의존성·ref 1회 보장·eslint 예외 주석 포함). 의미 변경 금지.

## 2. 고려한 대안
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 훅을 `app/` 옆 파일로 | 단순 | expo-router가 `app/` 파일을 라우트로 인식 | ❌ |
| 훅을 기존 feature(analysis)에 | 폴더 추가 없음 | feature→feature import 위반(capture·upload·auth 참조) | ❌ |
| `src/widgets/home-session/`(상위 레이어) | FSD 규칙 준수, 교차 조합 정위치 | 새 레이어 폴더 | ✅ |
| 화면 단위 ViewModel 훅 하나(`useHomeViewModel`)로 전부 | 호출 1개 | 세션·온보딩 책임 혼재, 재사용성↓ | ❌ |
| 렌더 분기까지 위젯 컴포넌트로(`<HomeSession/>`) | route 더 얇음 | 이번 요구(훅 분리) 범위 초과, 네비 주입 늘어남 | ❌(후속 가능) |
| XState 상태 머신 | 전이 명시 | 의존성 추가·과설계 | ❌(N3) |

- `mergeSessionPhase` 반환 phase 타입은 `"idle" | ProcessingPhase`(features/home에서 import — widgets→features 허용). 기존 route의 `as Exclude<...>` 캐스트 유지.

## 3. 영향받는 코드
- 신규: `src/widgets/home-session/**`
- 변경: `app/index.tsx`
- 새 의존성 없음.

## 5. 위험과 완화
- R1 자동 시작 중복/누락 → ref 로직 그대로 이동 + 훅 테스트(rerender 시 1회).
- R2 계정 변경 무효화 회귀 → 훅 테스트.
- R3 getAuth: 원래 렌더마다 재생성(eslint 예외 주석) → 모듈 스코프 상수로 이동(스토어는 getState로 호출 시점 조회라 의미 동일, 예외 주석 제거).
- R4 무료 소진(403, #114) 분기 보존 → `errorKind` 전달 + 테스트.

## 6. 롤아웃 / 되돌리기
- 단일 브랜치·PR. 문제 시 PR revert(동작 불변 리팩토링).

## 7. 검증
- 단위: mergeSessionPhase 표 기반, useAnalysisSession(renderHook, useUpload·useAnalysis·getAccessToken mock + 실제 zustand 스토어).
- 게이트 `checks.sh`.
- e2e: 시나리오 변경 없음(동작 불변) — 결과는 아래 §검증 결과에.

## 검증 결과 (2026-10-02)
- 단위: `mergeSessionPhase` 14 · `useAnalysisSession` 11 → 25 PASS. 모바일 전체 단위 PASS.
- 게이트 `checks.sh` **ALL PASS**.
- e2e(Maestro): `capture-gate` PASS(앱 부팅·미인증 게이트). `capture-empty`·`recent`·`profile-back`은 시뮬레이터가 **로그아웃 상태**라 로그인 화면에서 멈춤(회귀 아님, 환경). 카카오 자격증명 입력은 자동화 불가 → **수동 로그인 후 재실행 필요**.
- 사후 발견: develop의 #114 무료 소진(403) 분기 누락 → 복구 + 회귀 테스트 2개(trace 참조).
