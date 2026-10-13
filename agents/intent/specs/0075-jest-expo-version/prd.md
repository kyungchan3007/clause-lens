# PRD — jest-expo 버전 정렬 (Expo Doctor 게이트)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-13
- **이슈:** #192
- **관련 태스크**: 의존성 유지보수 (게이트 복구)

## 1. 문제 (Problem)
완료 게이트 `checks.sh`의 Expo Doctor가 FAIL한다. `apps/mobile`의 `jest-expo`가 `~57.0.5`로 핀 되어 Expo SDK 57이 기대하는 `~57.0.6`과 어긋나(설치 57.0.5), "packages match versions required by installed Expo SDK" 검사가 실패한다. develop 전체 게이트가 빨간 상태라 "done" 선언이 막힌다.

## 2. 목표 (Goals)
- G1. `jest-expo`를 Expo SDK 57 기대치(`~57.0.6`)로 정렬하고 lock을 갱신한다.
- G2. `checks.sh`가 Expo Doctor 포함 ALL PASS가 되게 한다.

## 3. 목표가 아닌 것 (Non-goals)
- N1. expo-doctor의 `userInterfaceStyle` 경고(app config)는 이번 범위 밖 — 별도.
- N2. 다른 패키지 일괄 업그레이드 아님 — jest-expo 단건 정렬만.

## 4. 사용자 흐름 (User Flow)
개발자/에이전트가 `checks.sh`를 돌릴 때 Expo Doctor가 통과해 완료 게이트가 초록이 된다.

## 5. 성공 지표 (Success Metrics)
- `pnpm dlx expo-doctor`의 버전 일치 검사 통과.
- `bash agents/harness/evals/checks.sh` ALL PASS.

## 6. 제약 (Constraints)
Expo v57 고정(버전 문서 기준). jest-expo는 SDK가 요구하는 범위로만 맞춘다. 단일 벤더 인프라·서버 권위 원칙 등 도메인 제약 무관(테스트 러너 버전).

### Acceptance
- [x] `apps/mobile`의 `jest-expo`를 `~57.0.6`으로 정렬 + pnpm-lock 갱신
- [x] `checks.sh` ALL PASS (Expo Doctor 포함)

## 7. 애매한 곳·가정 (Open Questions)
- 없음 — 기대 버전은 expo-doctor가 `~57.0.6`으로 명시했고, 단건 정렬이라 결정할 빈칸 없음
