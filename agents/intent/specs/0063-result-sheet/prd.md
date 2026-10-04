# PRD — 분석 결과 "전체 보기" 드래그 바텀시트

- **이슈:** #169
- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-04
- **관련 태스크**: TASK-U(결과 화면 후속)

## 1. 문제 (Problem)
- 결과 화면의 "확인이 필요한 조항" 목록은 이미지 카드(화면 0.42h) 아래 좁은 영역만 차지한다.
- 조항이 여러 건이면 좁은 영역에서만 스크롤해야 해 전체를 한눈에 훑기 어렵다.

## 2. 목표 (Goals)
- G1. "전체 보기"로 조항 패널을 전체화면까지 끌어올려 넉넉히 스크롤하며 읽는다.
- G2. 드래그(핸들) + 탭(버튼)으로 collapsed↔full 전환, 다시 접어 원래(이미지+요약) 상태로 복귀.
- G3. 기존 결과 화면 동작(좌표 하이라이트·상태 분리·스냅샷·목록↔이미지 연동)은 불변 보존.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 다크모드(`color()` light 고정 — 범위 밖).
- N2. 결과 데이터·분석 로직·계약 변경.
- N3. 목록 최상단에서 아래로 당겨 접기(스크롤↔팬 인계) — 후속(제스처 난도 큼).
- N4. 시트를 완전히 닫는 pan-down-to-close(접기는 collapsed까지만).

## 4. 사용자 흐름 (User Flow)
1. 결과 화면 진입 → 이미지 카드 + "확인이 필요한 조항 N" 섹션(collapsed, 기존 모습).
2. 섹션의 "전체 보기" 버튼(또는 핸들 탭/위로 드래그) → 조항 시트가 전체화면(full)으로 올라오며 이미지를 가리고 목록을 넉넉히 스크롤.
3. "접기" 버튼(또는 핸들 아래로 드래그/탭) → collapsed로 복귀, 이미지 다시 표시.
4. full에서 조항을 탭 → 접히며(collapsed) 해당 조항이 이미지 위에서 강조(기존 toggle 의미 유지).
5. Android 뒤로가기: full이면 collapsed로, collapsed이면 기존 화면 이탈.

## 5. 성공 지표 (Success Metrics)
- 전체 보기 열기→스크롤→접기 e2e(maestro) 통과, 조항 탭 시 접힘+강조 동작.
- 기존 좌표/선택/스냅샷/0건·incomplete·failed 단위 테스트 불변 통과.
- checks.sh PASS.

## 6. 제약 (Constraints)
- Expo v57 — 새 의존성은 SDK 57 호환 필수. 본 건은 **새 의존성 없이** reanimated 4.5.1 + gesture-handler ~2.32(기존)로 구현.
- 서버가 진실 — 표현/상호작용만 추가, 판정 로직 불변.
- spec 0022 불변: HighlightOverlay 좌표 변환·상태 분리·세션 스냅샷 매칭.
- 접근성: 드래그엔 탭 대체 필수(WCAG 2.2 AA Dragging Movements), 터치 44pt, reduce-motion.

## Acceptance
- [x] "전체 보기"로 조항 패널이 전체화면까지 올라오고 내부 스크롤된다 — 시뮬 실측(조항 4건 스크롤) OK.
- [x] 드래그(핸들) + 탭(버튼/핸들)로 collapsed↔full 전환 — 드래그 탭 대체 제공(SectionHeader "전체 보기/접기" 버튼). 버튼·핸들 드래그 실측 OK.
- [x] "접기"(버튼/핸들)로 원래 상태 복귀, Android 뒤로가기 full→collapsed — handleBackPress 단위 + 버튼/드래그 실측.
- [x] HighlightOverlay 좌표·상태 분리·스냅샷(0022) 동작 불변 — 시트는 이미지와 독립 절대배치, 좌표 하이라이트 실측 불변.
- [x] full에서 조항 탭 → 접히며 해당 조항 강조(기존 toggle 의미 유지), 이미지/좌표 없으면 자동 접기 안 함 — shouldCollapseOnClauseTap 단위 검증(육안은 후속).
- [~] 접근성: reduce-motion·터치 44pt·핸들 hitSlop/a11y(accessibilityRole·expanded) 구현. 스크린리더/reduce-motion 실측은 후속.
- [x] 단위(스냅 전이·a11y props) + maestro e2e(열기→접기) + 기존 좌표/선택/스냅샷 단위 불변 — ui 56·mobile 281 통과.
- [x] `bash agents/harness/evals/checks.sh` PASS.

## 8. 미해결 질문 (Open Questions)
- Q1. collapsed 높이 기준(목록 시작 위치 vs 고정 비율) — SDD §에서 확정, 실측 보정.
