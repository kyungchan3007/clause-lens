# SDD — 분석 결과 "전체 보기" 드래그 바텀시트

- **관련 PRD**: 0063-result-sheet/prd.md
- **이슈:** #169
- **상태**: draft — Codex 설계 토론(2026-10-04) 반영

## 0. 읽은 문서
- spec 0022(좌표·상태·degrade 불변), 0045(결과 리디자인: ResultHeader·SectionHeader count/hint·ClauseCard·HighlightOverlay), `frontend-architecture.md`(shared-first §75), `packages/ui`·`packages/tokens`, maestro `result.yaml`(S20), ui-ux-pro-max(드래그=탭 대체 필수 WCAG 2.2·GestureDetector·hitSlop).

## 1. 접근 (Approach)
- 결과 화면 하단 "조항 섹션+목록"을 **2단계(collapsed/full) 드래그 바텀시트**로 감싼다. 시트는 **이미지와 독립된 절대배치 형제** — 이미지 카드의 측정뷰·Image·SVG 구조·높이는 불변(좌표 정합 유지). full에서도 이미지는 unmount/`display:none` 하지 않고 **불투명 시트가 위를 덮는다**.
- 범용 `DragSheet`(핸들·스냅 애니메이션·a11y)는 `packages/ui`로 승격(shared-first). 결과 전용(조항·페이지·강조·상태 분기)은 `features/result`가 소유.
- 전환: "전체 보기"/"접기" 버튼(접근성 1차) + 핸들 탭 + 핸들 Pan 드래그. **MVP는 Pan을 핸들에 한정** → 목록 ScrollView와 제스처 충돌 없음(스크롤↔팬 인계는 후속).
- 새 의존성 없음: reanimated 4.5.1 + gesture-handler ~2.32(기존).

## 2. 고려한 대안 (Alternatives / Trade-offs)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 스냅 단계 | peek/half/full 3단계 | ❌ | 목적 겹침·제스처/접근성/테스트 상태만 증가(과설계) |
| | **collapsed/full 2단계** | ✅ | 요구(원래↔전체)에 정확히 매핑 |
| full 이미지 처리 | unmount / `display:none` | ❌ | 재진입 viewport 0·이미지 로드·재측정 경쟁 유발 |
| | **레이아웃 유지 + 불투명 시트로 가림** | ✅ | 좌표 측정 불변(0022), 재측정 경쟁 없음 |
| 시트 배치 | 이미지 부모 flex 높이 변경 | ❌ | 이미지 높이 바뀌면 SVG 좌표 어긋남 |
| | **이미지와 독립된 절대배치 형제, 시트만 이동** | ✅ | HighlightOverlay 좌표 변환 불변 |
| 구현 | `@gorhom/bottom-sheet` 래핑 | ❌ | Reanimated 4.5.1 + SDK 57 + RNGH 2.32 **호환 미확정**(Codex 경고), 새 의존성·번들·네이티브 리스크. 규칙#1(버전 고정) 위배 소지 |
| | **reanimated+gesture-handler 직접(최소 DragSheet)** | ✅ | 기존·SDK57 검증 라이브러리, 2스냅으로 단순, 전면 통제 |
| 제스처 | 목록 스크롤↔시트 팬 전면 인계 | 🟡 | 견고하나 iOS overscroll·관성·소유권 전환 난도 큼 → **후속** |
| | **Pan=핸들 한정 + 버튼/탭**(MVP) | ✅ | 충돌 없음·접근성 충족·구현 단순 |
| 트리거 | 핸들만 | ❌ | 발견성 낮음 + 드래그 전용=WCAG 위반 |
| | **SectionHeader 버튼("전체 보기"/"접기") + 핸들 탭·드래그** | ✅ | 발견성·접근성(탭 대체)·드래그 모두 |
| full 조항 탭 | 선택만 유지(접지 않음) | ❌ | 이미지 안 보여 강조 확인 불가 |
| | **접으며 기존 toggle 강조**(이미지/좌표 없으면 접지 않음) | ✅ | 0022 "탭→이미지 영역 보이기"에 부합 |
| 상태 소유 | useResultData에 기하·시트 상태 추가 | ❌ | 표시 상태 혼입(책임 분리 위배) |
| | **ResultScreen 로컬 `snapIndex` + 시트 내부 shared value** | ✅ | 선택 상태와 분리, 페이지/revision 변경 시만 초기화 |

## 3. 영향받는 코드 / 순서 (Touched Surface & Plan)
1. **공용 UI** `packages/ui/src/drag-sheet.tsx`(신규) + index + 단위:
   - controlled `{ snapPoints: number[](컨테이너 기준 높이, 오름차순), index, onIndexChange, children, header? }`.
   - 핸들(hitSlop·a11y role/label·expanded 상태) + Pan 제스처(activeOffsetY ±8~12, failOffsetX) + 탭으로 index 토글. reanimated로 translateY 스프링, reduce-motion 시 축소.
   - 본문은 children(결과 화면이 ScrollView 주입). full일 때만 높이 확장.
2. **결과 화면** `features/result/ui/ResultScreen.tsx`:
   - 조항 섹션+ScrollView를 `DragSheet`로 감싸고, 이미지 카드는 그 아래(형제) 절대배치 유지. `snapIndex` useState(0=collapsed,1=full).
   - SectionHeader에 action 버튼("전체 보기"↔"접기", onPress=index 토글) — hint는 유지/문구 조정.
   - full에서 조항 탭 → `toggleClause(id)` + (이미지·좌표 유효 시) `setSnapIndex(0)`.
   - Android `BackHandler`: full→collapsed, 아니면 기본.
   - 페이지/revision 변경 시 snapIndex=0, 목록 스크롤 top 리셋.
3. **SectionHeader**(필요 시) `packages/ui/src/section-header.tsx`: 기존 `action` 슬롯 사용(이미 지원). 없으면 최소 확장.
4. **테스트**: `drag-sheet.test.tsx`(스냅 전이·index controlled·a11y·disabled 없음), ResultScreen 분기 단위(full 탭→접힘+toggle, 이미지 없으면 접지 않음), 기존 coordinateTransform·useResultData·risk 단위 불변. maestro S20에 전체 보기 열기→스크롤→접기 추가.

## 4. 위험과 완화 (Risks)
- R1 시트가 이미지 좌표 측정을 깨뜨림 → 이미지 카드 구조·높이 불변, 시트는 절대배치 형제로 분리, 시트 이동량을 SVG 좌표에 더하지 않음(0022 가드).
- R2 reanimated 4.x 제스처/애니메이션 실기기 거동 → 시뮬 실측(열기·접기·탭), reduce-motion 분기 확인.
- R3 접근성(드래그 불가 사용자) → 버튼 전환 1차 경로, 핸들 a11y, 포커스 이동(full 진입 시 제목).
- R4 큰 글씨에서 헤더/버튼 겹침 → 줄바꿈 허용, 44pt 보장.

## 5. 검증 (Verification)
- **단위**: `drag-sheet.test.tsx` 신규, ResultScreen 상호작용 단위(full 탭→접힘·toggle, 이미지 없음 시 비접힘, Android back). 기존 coordinateTransform·useResultData·risk·section-header·pager 단위 불변.
- **게이트**: `bash agents/harness/evals/checks.sh` PASS.
- **maestro S20**: 전체 보기 열기 → 목록 스크롤 → 접기 → 이미지 재확인 assert(분석 내용 하드 assert 금지).
- **시뮬 실측(다음)**: 열기/접기 애니메이션·핸들 드래그·조항 탭 접힘+강조·reduce-motion.
