# 0041 — 홈 분석 세션 로직 커스텀 훅 분리 — PRD

> **관련 태스크**: #118 · **상태**: in-progress · **유형**: refactor(동작 불변) · **갱신**: 2026-10-02

## 1. 문제
- `apps/mobile/app/index.tsx`(249줄)에 업로드→분석 세션 로직과 마크업이 혼재.
- 스토어 구독 약 15개, `useEffect` 3개(편집 잠금·분석 자동 시작·계정 변경 무효화), 핸들러 4개, 상태 병합 `merged()`가 렌더 파일 안에 있음.
- 결과: 세션 로직 단위 테스트 불가, `merged()`(수기 상태 머신) 테스트 부재, "라우트는 얇게"(frontend-architecture) 위반.

## 2. 목표
- G1. 세션 로직을 커스텀 훅 `useAnalysisSession()`으로 추출 → route는 훅 반환값으로 렌더만.
- G2. `merged()`를 순수 함수 `mergeSessionPhase()`로 분리 + 단위 테스트.
- G3. 홈 4상태 중 온보딩 판정도 훅(`useHomeOnboarding`)으로 이동.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 화면·문구·흐름 변경 없음(순수 구조 변경).
- N2. `app/result.tsx`(#119)·`ProfileScreen`(#120)은 별도 이슈.
- N3. 상태 머신 라이브러리(XState) 도입 — 단계가 늘면 후속 판단.
- N4. 네비게이션(router.push)은 route(screens 레이어)에 유지.

## 4. 제약
- FSD: capture·upload·analysis·auth·documents 교차 조합 → feature 안에 둘 수 없음 → 상위 레이어 `src/widgets/home-session/`.
- 완료 전 `checks.sh` PASS. 단위 테스트 필수, e2e는 기존 시나리오(동작 불변) 회귀 확인.

## Acceptance
- [x] `useAnalysisSession`·`useHomeOnboarding` 추출, `app/index.tsx`는 렌더 전용(useEffect·스토어 직접 구독 없음).
- [x] `mergeSessionPhase` 순수 함수 + 단위 테스트(업로드 활성·오류·분석 진행·터미널·idle·quota).
- [x] `useAnalysisSession` 훅 단위 테스트(자동 시작 1회·계정 변경 무효화·취소/재시도/초기화 분기·편집 잠금·홈 확인 다이얼로그).
- [x] 기존 단위 테스트 전부 통과 + 게이트 PASS.
- [ ] e2e: 동작 불변이라 시나리오 변경 없음, 기존 홈·분석 시나리오 회귀 확인. (부분: capture-gate만 PASS — 시뮬레이터 로그아웃 상태라 로그인 이후 시나리오는 카카오 수동 로그인 후 사용자 확인 필요)
