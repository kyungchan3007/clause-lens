# 0067 — 결과 화면 Skia 하이라이트 전환 + 구역 탭 (TRACE)

- **이슈:** #176 · **의존:** #175

## 2026-10-08

### 착수
- 결과 하이라이트 Skia 전환(A안) + 사진 구역 탭. 사용자 요구: Skia로 문서 렌더·구역 색칠, 설명 구간은 그대로. 탭 동작은 "사진 구역도 탭 가능" 선택.
- 원문 고정: `pnpm request 176` → request.md(불변).

### 설계 토론 (Codex 적대적 검토, 2026-10-08)
- A안(정규화 이미지) vs B안(원본) 기술 검토 → A 확정(좌표 정합·EXIF/메모리). 근거: 박스가 서버 upright 픽셀 공간에 묶임.
- Codex 지적 반영(SDD §3):
  - useImage 세대 검증·reject catch 부재 → **generation token + revision identity**로 stale(이전 이미지+현재 박스) 혼합 차단.
  - isSizeConsistent(크기)만으론 EXIF·다른페이지 통과 → #175 revision identity에 의존.
  - 탭 겹침 우선순위·44pt·변환 1회·메모리 예산·web CanvasKit 선import 차단.
  - Skia 성능 우위는 정적 탭만으론 미입증 → 채택 명분을 **화질·확대 로드맵**으로 명문화(과대광고 금지).
- 선행 의존 분리: 정규화 이미지 공급은 백엔드 #175(0066)로 떼어냄 — 이 이슈는 그 위에서 표현 레이어만 교체.
- (주의) Codex exec가 검토 범위를 넘어 TASKS/JOURNAL 수정·게이트 실행 → 되돌림. 설계 결론만 채택.

### 구현 (2026-10-08, #175 머지 후)
- 매핑(Explore): `current`가 계약 `PageAnalysisResult` 그대로라 `current.normalizedImage`가 이미 존재 → **threading 불필요**. 좌표 기준 = `normalizedImage.{width,height}`(boxes와 동일 픽셀 공간).
- `lib/hitTest.ts`(순수): 화면 좌표 → `boxToScreenRect` 역비교로 조항 선택. **겹치면 면적 작은 박스 우선**, **44pt 최소 히트**(작은 박스 패딩). 단위 5건.
- `ui/SkiaHighlightCanvas.tsx`: `useImage(url)` + `<Canvas>`에 `<Image>`(contain-fit) + 조항별 `<RoundedRect>`(채움+테두리, 선택 강조). `GestureDetector`+`Gesture.Tap` → `runOnJS(hitTest)` → `onSelectClause`. **skImage 로드 전엔 이미지·박스 모두 미그림**(stale 혼합 방지 — 로드되면 현재 페이지 이미지+박스가 함께).
- `ResultScreen.tsx`: imageBlock을 **normalized 있으면 Skia / 없으면 기존 Image+SVG(하위호환) / 없으면 안내** 3분기. 탭 선택은 기존 `onClauseTap` 재사용(목록↔캔버스 동기화). mismatchNotice는 `!normalized`에만.
- **revision identity**: `normalizedImage.revision`은 서버가 페이지 revision으로 생성 → `current`의 이미지·박스는 항상 동일 revision(교차 혼합 구조적 불가). 비동기 로드만 skImage 게이트로 처리.
- 설명 구간(DragSheet/ClauseList)·좌표 변환·상태·시트 불변. web CanvasKit는 기존 `async-skia`/`copy-canvaskit` 경로(네이티브는 임베드).
- 게이트: `bash agents/harness/evals/checks.sh` **ALL PASS**(mobile 292·ui 등).
- maestro `result.yaml`: 결과 진입·#169 드래그시트 커버 유지. **구역 탭(캔버스 제스처)은 maestro 자동화 어려움 → 시뮬 육안**.

### 시뮬 육안 (2026-10-08)
- 로컬 백엔드(API·worker 실 Vision+Claude·MinIO) 재기동 + 카카오 로그인(사용자) + 갤러리 계약서 분석 1회.
- **Skia 렌더 정상**: 결과 화면에 서버 정규화 이미지가 Skia `<Canvas>`로 그려지고, 위험 구역이 색칠(제2·3조 중립 박스·제4조 red 박스)로 올라감. 좌표 정합 정확(해당 조항 위).
- **구역 탭 동작**: red 제4조 구역을 탭 → 제4조 박스들이 강조(테두리 굵게·채움 진하게) + 목록 "임대인의 일방적 해지 가능 조항(높음)" 카드가 파란 선택 테두리 → **캔버스↔목록 selectedClauseId 동기화 확인**.
- revision identity·세대 격리(key 리마운트)·디코드 예산(일반 사진 예산 안)은 PR 리뷰 반영분으로 적용. 메모리 이슈 없음(1장 분석).
- Acceptance 전부 충족.

### 남음 / 다음
- web CanvasKit 프리로드 경로는 네이티브 외 환경에서만 영향 — 후속 확인.
