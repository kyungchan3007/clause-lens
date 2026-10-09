# TRACE — README 최신화 (#188)

- 2026-10-10 착수. README 현황이 2026-09-29 기준이라 실제와 큰 격차 확인.
- 실제 상태 대조: TASKS.md 기준 TASK-004(OCR·하이라이트)·005(로그인·자격)·008(재열람·7일 보관) done, 006은 ②보관전환(#163)·③만료삭제(#164) done, ④구독 결제(#165)만 대기, 007 todo. UI 리디자인(U0~U5) 전부 done.
- 구현 사실 확인: 하이라이트는 Skia(SkiaHighlightCanvas, 서버 정규화 이미지 #175/#176)가 주 경로, react-native-svg(HighlightOverlay)는 대형 이미지 OOM 폴백 → 스택 배지 Skia 유지 타당. TanStack Query는 아직 미설치 → "예정" 유지.
- 판단: 상태 블록만 최소 치환(대안 A). 설계·흐름·스택 서술은 유효하므로 보존.
