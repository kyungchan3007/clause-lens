<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #169

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/169
- 캡처: 2026-10-04

---
## 배경
- 결과 화면의 "확인이 필요한 조항" 목록은 이미지 카드(0.42h) 아래 영역만 차지 → 조항이 많으면 좁은 영역에서만 스크롤
- 조항 전체를 한눈에 훑을 공간이 부족

## 요구 (사용자 원문)
- "전체 보기" 인터랙션 추가 → 조항 패널이 전체화면으로 올라오고 스크롤
- 다시 접어 원래(이미지+요약) 상태로 복귀
- 방식: 드래그 가능한 바텀시트 (드래그 + 탭)

## 설계 요지 (Codex 토론 반영 — 상세는 spec SDD)
- 2단계 스냅(collapsed/full), 3단계는 과설계
- 시트는 이미지와 독립된 절대배치 형제 → HighlightOverlay 좌표(0022) 불변
- full에선 이미지 레이아웃 유지한 채 불투명 시트 뒤로 가림(unmount 금지)
- 트리거: SectionHeader "전체 보기"/"접기" 버튼 + 핸들 탭·드래그 (드래그 전용 금지=WCAG 2.2)
- full에서 조항 탭 → 접으며 기존 강조 실행
- shared-first: 범용 `DragSheet`를 packages/ui에 (controlled)
- 구현: 새 의존성 없이 reanimated+gesture-handler 직접 (gorhom은 RN Reanimated4/SDK57 호환 미확정 → 배제)

## Acceptance
- [ ] "전체 보기"로 조항 패널이 전체화면까지 올라오고 내부 스크롤
- [ ] 드래그(핸들) + 탭(버튼/핸들)로 collapsed↔full 전환, 드래그 탭 대체 제공(WCAG 2.2)
- [ ] "접기"(버튼/핸들 드래그)로 원래 상태 복귀, Android 뒤로가기 full→collapsed
- [ ] HighlightOverlay 좌표·상태 분리·스냅샷(0022) 동작 불변
- [ ] full에서 조항 탭 → 접으며 해당 조항 강조(기존 toggle 의미 유지)
- [ ] 접근성: reduce-motion, 큰 글씨, 스크린리더 상태 안내, 터치 44pt, 핸들 hitSlop/a11y
- [ ] 단위(스냅 전이·a11y) + maestro e2e(열기→스크롤→접기) + 기존 좌표/선택/스냅샷 단위 불변
- [ ] bash agents/harness/evals/checks.sh PASS

## 범위 밖
- 다크모드(color() light 고정), 결과 데이터/분석 로직 변경
- 목록 최상단 당겨 접기(스크롤↔팬 인계)는 후속
