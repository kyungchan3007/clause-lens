# 0063 — 분석 결과 "전체 보기" 드래그 바텀시트 (TRACE)

- **이슈:** #169

## 2026-10-04

### 착수
- 사용자 요구: 결과 화면 조항 목록에 "전체 보기"(드래그 바텀시트) — 전체화면으로 올라와 스크롤 + 접기.
- #167 리디자인(#168)이 develop 머지 완료된 위에서 새 기능 → develop 기준 새 이슈 #169 + `feat/169-result-sheet`.
- 현재 ResultScreen 구조·가용 라이브러리(reanimated 4.5.1·gesture-handler ~2.32) 확인. ui-ux-pro-max: 드래그=탭 대체 필수(WCAG 2.2)·GestureDetector·hitSlop.

### 설계 토론 (Codex, 완료)
- 2단계 스냅(collapsed/full), 3단계는 과설계.
- 시트=이미지 독립 절대배치 형제, full에서 이미지 unmount 금지(불투명 시트로 가림) → 좌표 측정 불변(0022).
- 트리거: SectionHeader "전체 보기"/"접기" 버튼 + 핸들 탭·드래그.
- full 조항 탭 → 접으며 기존 toggle 강조(이미지/좌표 없으면 접지 않음).
- shared-first: 최소 범용 `DragSheet`(controlled) packages/ui.
- 상태: ResultScreen 로컬 snapIndex, selectedClauseId는 전이로 안 지움.
- 구현: Codex는 `@gorhom/bottom-sheet` 추천하되 **Reanimated4/SDK57 호환 미확정** 강조 → **직접 구현 채택**(새 의존성 배제, 규칙#1 버전 고정 준수). 제스처 난도(스크롤↔팬 인계)는 MVP에서 Pan=핸들 한정으로 회피, 후속.

### 구현·검증
- 공용 `packages/ui/src/drag-sheet.tsx`(신규): controlled 2스냅 바텀시트(reanimated 4.5.1 + gesture-handler). 순수 로직 `drag-sheet.lib.ts`(clampIndex·toggleIndex·resolveSnapIndex·occupyToTranslateY·isExpanded) 분리 + 단위 테스트. index export. peer+dev에 reanimated·gesture-handler 추가.
- 결과 전용 `features/result/lib/sheet.ts`(신규): shouldCollapseOnClauseTap·computeCollapsedOccupy·handleBackPress + 단위. `ResultScreen` 통합(콘텐츠 컨테이너 overflow-hidden·이미지 위 절대배치 시트·SectionHeader action "전체 보기↔접기"·full 조항 탭 시 접기·Android back·페이지 전환 시 collapsed 리셋·푸터는 시트 밖 항상 표시).
- maestro S20에 전체 보기 열기→접기(버튼 경로) + 푸터 상시 assert 추가.
- **jest 정비**: `@clause-lens/ui` 배럴이 DragSheet→reanimated를 eager import → 배럴 쓰는 모든 모바일 테스트가 worklets 네이티브 init(loadUnpackers)에서 실패. `apps/mobile/jest.after-env.js`에 worklets 비의존 reanimated mock + gesture-handler jestSetup 추가로 해결.
- **버그 수정(시뮬 실측)**: Pan `.onEnd` 워클릿에서 JS 함수 `resolveSnapIndex` 동기 호출 → `[Worklets] Tried to synchronously call a Remote Function`(dev 에러 토스트). `runOnJS(settleToSnap)`로 JS에서 계산하도록 수정.
- 게이트: `bash agents/harness/evals/checks.sh` **ALL PASS**(ui 56·mobile 281 포함, 타입체크 ui/mobile OK).
- **시뮬레이터 육안(실 Vision+Claude 분석, 조항 4건)**: collapsed 렌더(이미지+4하이라이트+핸들+"전체 보기")·버튼으로 full 확장(조항 4건 스크롤+"접기", 푸터 유지, 이미지 가림)·핸들 드래그로 접기(수정 후 워클릿 에러 0) 모두 정상. 좌표 하이라이트(빨강/주황) 불변 확인.
- 남음: 조항 탭→접힘+강조는 단위(shouldCollapseOnClauseTap)로 검증·육안은 후속, reduce-motion/스크린리더 실측은 후속.
