# 0037 — 담은 페이지 2열 썸네일 그리드 — SDD

> **관련 PRD**: prd.md · **이슈:** #110 · **갱신**: 2026-10-01

## 1. 접근 (Approach)

### 1-1. 라이브러리
- `react-native-sortables@1.10.1`(고정) `Sortable.Grid` — columns=2. reanimated 4.5.1/gesture-handler 2.32 기반(새 네이티브 모듈 없음, peer: reanimated>=3·gh>=2 충족).
- draggable-flatlist(PageList·PageItem만 소비) 제거.

### 1-2. draftStore (model) — 정합성 핵심
- `DraftPage`/`DraftImageInput`에 `thumbUri: string` 추가(표시용, 업로드엔 미사용).
- **`reorderByIds(ids: string[])`** 신설: 주어진 id 배열이 현재 pages의 **id 집합과 정확히 일치할 때만** 그 순서로 재배열 + reindex. 불일치(삭제·추가로 집합 변동)면 **no-op**(stale 드롭 방어). `setPages` 전체 교체는 그리드 드롭에 사용 안 함.
- **`dragging` 플래그** + `setDragging(b)`: true면 add/remove/replace **거부**(store 레벨), app이 분석 시작도 차단. `clear()`는 dragging=false로도 리셋.
- 기존 add/remove/replace/clear는 `locked||dragging`이면 거부.

### 1-3. 썸네일 (lib)
- `makeThumbnail(uri, targetW)`(expo-image-manipulator resize) → 작은 JPEG uri. `normalizeToJpeg` 후 호출해 `thumbUri` 채움(useImagePicker의 add/replace 경로). targetW ≈ 카드폭(≈ (화면폭-여백)/2)×pixelRatio, 상한 두기.
- 실패 시 thumbUri=localUri 폴백(렌더는 되게).

### 1-4. UI (capture/ui)
- **PageList 재작성**: `Sortable.Grid`(columns=2, data=표시 배열) + 헤더 + 하단 분석 바. 스크롤 컨테이너 1개(Grid 자체 스크롤 or 외부 ScrollView+scrollableRef), 하단 바는 스크롤 밖 고정.
  - 표시 배열: `[...pages(PageCell), AddCell]`. AddCell은 `fixed-order`(드래그·이동 불가, 고정 key). onDragEnd → 결과에서 **페이지 id만 추출** → `reorderByIds`.
  - onDragStart→`setDragging(true)`, onDragEnd/취소→`setDragging(false)`.
  - 0장: 그리드 없이 추가 CTA만(분석 버튼 비활성). 1장: sortEnabled=false.
- **PageCard**(PageItem 대체): 이미지(thumbUri, contain, aspectRatio 3/4) + 페이지 번호 + 우상단 X. `customHandle`=이미지 본문(롱프레스 드래그), X는 핸들 밖 형제(44/48 영역). 탭(핸들 영역, 드래그 미발생 시)=미리보기 열기. accessibilityActions: 앞으로/뒤로(reorderByIds로 1칸 이동, 끝장 비활성), label "N페이지", 삭제 label "N페이지 삭제".
- **AddCell**: 점선 카드 + "+ 추가"(44/48). onPress=captureToDraft("library").
- **PagePreviewModal**(신규): RN Modal 전체화면. 큰 이미지(localUri, contain) + "이 페이지 교체"(replaceDraft, id·order 유지·취소 무변경)·"삭제"·닫기. dragging/locked면 교체·삭제 비활성.

### 1-5. app/index (조립)
- 분석 시작 전 `dragging` 차단(이미 locked 연동). 라우팅 불변(idle→CaptureScreen→PageList).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| draggable-flatlist 유지 | 교체 없음 | 2열 드래그 불가(시안 포기) | ❌ |
| 커스텀 reanimated 드래그 | 의존 0 | 자동스크롤·제스처 유지보수 부담 큼 | ❌ |
| react-native-sortables Grid | 2열·자동스크롤·핸들 제공 | 새 dep·버전 민감 | ✅ 1.10.1 고정 |
| "+추가" 그리드 밖 footer | 단순 | 홀수 장 마지막 칸 안 참 | ❌ |
| "+추가" non-draggable sentinel | 간단 | 다른 항목 재정렬 따라 **중간으로 밀림** | ❌ |
| "+추가" `fixed-order` sentinel(표시 배열) | 시안 일치·위치 고정 | 표시/저장 분리 필요 | ✅ |
| DraftPage[]에 add sentinel 삽입 | 코드 간단 | **저장 배열 오염**(가짜 페이지 업로드 위험) | ❌ |
| 드롭=setPages 전체 교체 | 간단 | **stale 드롭이 삭제/교체 되돌림**(치명) | ❌ → reorderByIds(집합검증) |
| 탭=즉시 교체 | 적은 UI | 확인/변경 혼동·오조작 | ❌ → 미리보기 모달 |
| 교체 제거 | 최소 | 삭제+추가는 맨 뒤로·취소 시 원본 유실 | ❌ → 미리보기에 보존 |
| aspectRatio만(원본 렌더) | 코드 0 | 12MP RGBA≈48MB·다수 OOM 위험 | ❌ → thumbUri 생성 |

## 3. 검증 (Verification)
- **단위(draftStore)**: reorderByIds(집합 일치 재배열·불일치 no-op·reindex) · dragging 중 add/remove/replace 거부 · clear가 dragging 리셋 · thumbUri 보존.
- **단위(표시 배열)**: pages→(PageCell+AddCell) 변환, 드롭 결과에서 id 추출(AddCell 제외), 0/1장 분기.
- **단위(UI)**: PageCard(이미지·X·페이지번호·a11y 액션 앞/뒤·끝장 비활성) · AddCell · PagePreviewModal(교체·삭제·닫기). jest.ui/mobile.
- **게이트**: `checks.sh`(typecheck·expo-doctor·**단일 네이티브 버전**·단위) PASS.
- **실기기(필수, 후속 가능)**: iOS·Android에서 최대 장수·빠른 연속 이동·끝단 자동스크롤·화면 이탈/복귀·드래그 중 삭제 시도. New Arch 성능.
- 로그인 벽으로 라이브 담은 페이지 육안은 캡처 플로우 구동 가능 여부에 따름(후속 표기).
