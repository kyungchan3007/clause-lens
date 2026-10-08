# SDD — 결과 화면 Skia 하이라이트 전환 + 구역 탭 (#176)

- **이슈:** #176 · **의존**: #175(정규화 이미지 공급) · **번복 근거**: 0022(§⑤ SVG)
- **작성**: Claude · **날짜**: 2026-10-08

## 1. 설계 개요
- 결과 이미지 블록만 교체: RN `<Image>` + `HighlightOverlay(react-native-svg)` → **Skia `<Canvas>`**(정규화 이미지 draw + 색칠 Rect). 나머지(ResultScreen 상태·DragSheet·ClauseList·ResultHeader·좌표 변환)는 불변.
- 그릴 이미지 = **#175가 준 정규화 이미지 URL**(서버가 본 바로 그 픽셀). 좌표계·변환(`coordinateTransform`)은 그대로 재사용.
- 사진 구역 탭 = Skia 캔버스 위 Gesture로 좌표를 받아 **화면좌표→서버박스 역변환**해 어떤 조항인지 판정 → `toggleClause`(기존 선택 흐름 재사용).

## 2. 접점 (touch points)
- `apps/mobile/src/features/result/ui/ResultScreen.tsx`: imageBlock의 `<Image>`+`<HighlightOverlay>` → `<SkiaHighlightCanvas>`. viewSize onLayout·overlayEnabled 게이팅 유지(단, 크기비교 → revision identity로 강화).
- 신규 `ui/SkiaHighlightCanvas.tsx`: `useImage(url)` + `<Canvas>`에 `<Image>`(contain fit) + 조항별 `<RoundedRect>`(fill+stroke, 선택 강조). Tap Gesture 포함.
- `HighlightOverlay.tsx`(SVG): 제거 또는 web 폴백용 보존(Q1).
- 신규 `lib/hitTest.ts`(순수함수): 화면 좌표 → 어떤 clause box인지(겹침 우선순위·44pt 최소 히트). `coordinateTransform`의 fit를 역으로 사용.
- `components/async-skia.tsx`(web): CanvasKit 로드. 네이티브는 async-skia.native(embedded). web 진입 시에만 선로드.
- `model/useResultData`·`selectedClauseId`·`DragSheet`·`ClauseList`: **불변**(선택 동기화 그대로).

## 3. 핵심 설계 조건 (Codex 적대적 검토 2026-10-08 반영)
| 리스크 | 조치 |
| --- | --- |
| useImage가 source 교체 시 세대 검증·reject catch 없음 → 이전 이미지+현재 박스 혼합 | **generation token**: 현재 page/revision과 로드된 이미지의 revision 일치 시에만 draw/hit. 로딩 중·불일치는 숨김 |
| isSizeConsistent(크기)만으론 EXIF·다른페이지 통과 | **revision identity 결합**(#175 제공): 이미지 revision == 결과 revision 검증 |
| 탭 겹침 | 겹친 박스 우선순위 명시(최소 면적 우선 기본, Q2) · 44pt 최소 히트 영역 |
| 변환 중복 | 화면공간 변환 1회(PixelRatio 추가 금지), SVG viewBox 추가 스케일 없음(0022 §④ 계승) |
| 메모리 | 디코드 픽셀수·최대변 예산(과대 이미지 down-scale 정책) |
| 성능 명분 | Skia 채택 이유 = **화질·확대 로드맵**(정적 박스+탭은 SVG로도 충분) — 과대광고 금지 |
| web | CanvasKit 선import 차단(네이티브 경로 영향 없게) |

## 4. 탭 히트테스트 (순수함수 분리)
- 입력: tap(x,y) 화면좌표, `image`(서버 크기), `view`(측정), `clauses[]`.
- `computeContainFit` 역: 화면 → 서버 픽셀 좌표. 각 clause.boxes와 포함 판정. 44pt 반경 허용(가장자리 탭).
- 겹치면 **면적 작은 박스 우선**(세밀한 조항 우선, Q2). 매칭 없으면 선택 해제 안 함(no-op).
- 반환: clauseId | null. ResultScreen이 `onClauseTap(id)`로 연결(기존 collapse 로직 재사용).

## 5. 테스트
- 순수 단위: `hitTest`(포함·겹침 우선순위·44pt·범위 밖), revision identity 게이팅 로직.
- Skia 캔버스 렌더는 네이티브 목 비용 큼 → **e2e(Maestro)**로 커버(0011 방침): 결과 진입·구역 탭·페이지 전환 stale 없음.
- 게이트: `bash agents/harness/evals/checks.sh` PASS(jest에 skia 목 — 기존 transformIgnorePatterns에 skia 포함).

## 6. 구현 순서(제안)
1. #175 머지 후 정규화 이미지 URL·revision이 결과에 들어온 상태 전제.
2. `lib/hitTest.ts` + 단위(순수).
3. `ui/SkiaHighlightCanvas.tsx`(useImage + Canvas + Rect + Tap Gesture + 세대/ identity 게이팅).
4. ResultScreen imageBlock 교체, overlayEnabled → revision identity.
5. web CanvasKit 선로드 경로 점검, SVG 폴백 결정(Q1).
6. maestro result.yaml에 구역 탭 시나리오 + 게이트 → 시뮬 육안.

## 7. 롤백·안전
- 이미지 블록만 교체라 실패 시 SVG 경로로 복귀 쉬움(HighlightOverlay 보존 시). 좌표·상태·시트 불변이라 영향 격리.
