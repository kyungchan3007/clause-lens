# 0028 — expo-constants 57.0.20 정렬 — PRD

> **이슈:** #92 · **관련 태스크**: #92 (chore) · **상태**: in-progress · **유형**: chore (모바일 의존성)

## 1. 문제
완료 게이트 `checks.sh`의 **Expo Doctor**가 실패한다 — `expo-constants`가 Expo SDK 57이 요구하는 `~57.0.20`과 어긋난 `57.0.19`로 설치돼 있다. 특정 기능과 무관하게 모든 브랜치에서 게이트를 막는다(TASK-005 #90 작업 중 발견). 성격(모바일 의존성 정렬)이 달라 별도 이슈로 분리.

## 2. 목표
- G1. `apps/mobile`의 `expo-constants`를 `~57.0.20`로 정렬.
- G2. `expo-doctor`·전체 `checks.sh` green.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 다른 패키지 일괄 업그레이드 — 이번 드리프트만.
- N2. `userInterfaceStyle` 경고 처리 — 실패 아님(경고), 별건.

## 4. 제약 (Constraints)
- Expo 버전 고정 문서 기준(SDK 57). base=develop. pnpm만 사용.

## Acceptance
- [x] `apps/mobile`에서 `pnpm dlx expo-doctor`가 통과한다(패키지 버전 불일치 0건). (21/21 통과 — expo-constants ~57.0.20)
- [x] 전체 `bash agents/harness/evals/checks.sh`가 ALL PASS. (16개 항목 전부 PASS)
