# TRACE — jest-expo 버전 정렬 (#192)

- 2026-10-13 착수. #190(README 재구성) 게이트 돌릴 때 Expo Doctor만 FAIL 발견 — jest-expo `57.0.5` vs 기대 `~57.0.6`. 문서 PR과 성격이 달라 분리(이 이슈).
- B안: README 먼저 머지(#191) 후 이 건을 별도로. 사용자 "B안 지금 시작" 지시로 같은 세션에서 처리.
- 판단: 숨김(install.exclude) 대신 근본 정렬(대안 A). 단건 설치로 lock 변동 최소화.
