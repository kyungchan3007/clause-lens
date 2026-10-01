# 0037 — 과정 기록 (trace)

## 판단
- 순서1에서 보류한 담은 페이지 2열 그리드. **착수 전 Codex 적대 설계 토론**(grid). 핵심 반영:
  - (A) sortables "reanimated4 지원"만 보고 교체 금지 → **1.10.1 고정**(4.5/worklets·native useDerivedValue 수정 포함). 게이트는 필요조건, 실기기 검증 별도. draggable-flatlist는 검증·소비처 제거 후.
  - (B) "+추가"는 non-draggable이 아니라 **`fixed-order`**(순서 이동도 차단) + 표시용 `(PageCell|AddCell)` 배열. DraftPage[]에 가짜 페이지 금지, 드롭 시 id만 추출.
  - (C) 탭=즉시 교체 금지 → **전체화면 미리보기 모달**(교체·삭제). 교체 제거도 기능 손실(삭제+추가는 맨 뒤·취소 시 원본 유실).
  - (D) X에 stopPropagation만으론 부족 → **customHandle=이미지 본문**, X는 핸들 밖 형제. ~300ms 지연·스크롤 1컨테이너·하단 바 밖.
  - (E) 드래그만은 접근성 누락 → 카드 accessibilityActions(앞/뒤)·끝장 비활성·이동 안내. 44/48 실제 영역·"N페이지 삭제" 레이블.
  - (F) aspectRatio는 메모리 최적화 아님(12MP RGBA≈48MB) → **표시용 썸네일 별도 생성**(thumbUri), contain·페이지번호.
  - (G) 치명: ① stale 드롭이 삭제/교체 되돌림 → `reorderByIds`(id 집합 검증, 불일치 no-op) ② `locked`만으론 드래그 세션 보장 X(clear가 잠금 해제) → `dragging` 플래그·세션 무효화. 드래그 중 편집·분석 차단. 0장=추가만, 1장=재정렬 비활성.
- **사용자 결정(AskUserQuestion)**: ① 탭=전체화면 미리보기 모달(교체·삭제) ② 표시용 썸네일 지금 생성.
- 라이브러리: react-native-sortables **1.10.1**(npm latest, peer reanimated>=3·gh>=2 충족).

## 막힘 / 되돌림
- **sortables API 확인 후 구현**: `Sortable.Grid`(columns·data·renderItem·keyExtractor·onDragEnd({data})·onDragStart·sortEnabled·customHandle·scrollableRef·dragActivationDelay). `Sortable.Handle mode="draggable"|"fixed-order"`. onDragEnd가 재정렬된 data를 줘서 AddCell 제외하고 id 추출 → reorderByIds.
- **표시/저장 분리**: 그리드 data=`(PageCell|AddCell)`, keyExtractor=id/ADD_KEY. DraftPage[]엔 AddCell 안 들어감. 드롭·a11y 이동 모두 `reorderByIds`(집합 검증) 경유.
- **customHandle**: Grid `customHandle` + PageCard 이미지에 `Sortable.Handle`(draggable), AddCell에 `fixed-order`. X·추가는 핸들 밖, 44pt. 탭=미리보기 모달.
- **썸네일**: normalizeToJpeg가 `makeThumbnail`(resize ≤540px) 호출해 thumbUri 채움, 실패 시 localUri 폴백. DraftPage/DraftImageInput에 thumbUri 추가. 그리드=thumbUri, 미리보기=localUri.
- **draggable-flatlist 제거**: PageItem 삭제·dep 제거(소비처 PageList·PageItem뿐). sortables 1.10.1 고정. X·Trash2 아이콘 레지스트리 추가.
- **테스트 함정**: (1) jest.mock 팩토리에 타입 주석 금지(외부 참조 에러) → 플레인 JS 팩토리. (2) sortables는 reanimated 네이티브 worklets 로드 → PageList 테스트에서 react-native-sortables·react-native-reanimated·useImagePicker 목(ProcessingScreen/IndeterminateBar는 RN 코어 Animated라 무관). (3) 보간 Text children은 배열 → join 비교.
- **데이터 정합성(G)**: setPages 전체 교체 제거, reorderByIds(집합 일치만)·dragging 가드(add/remove/replace 거부)·clear가 dragging 리셋. 단위 8케이스.
- **라이브 검증(iOS 시뮬레이터, 로그인 상태)**: 2열 그리드 1장·2장 시안대로 렌더 — 썸네일(contain)·페이지번호 배지·X·"+추가" 다음 줄 wrap(fixed-order)·하단 분석 바 전부 정상. 탭→전체화면 미리보기 모달(교체·삭제) 동작. **safe-area 수정**: Modal은 별도 네이티브 루트라 바깥 SafeAreaProvider inset 미적용 → 헤더가 상태바와 겹침 → 모달 안에 SafeAreaProvider 재감쌈으로 해결(실측 확인).
- **드래그 재정렬**: 합성 터치(touch_path)로는 gesture-handler 300ms 활성화가 안 잡힘(알려진 한계) → 라이브 재정렬 육안은 **실기기 손가락 후속**. reorderByIds 단위 8케이스 + a11y 앞/뒤 이동이 같은 경로를 커버.
- **후속**: iOS·Android 실기기 손가락 드래그(최대 장수·빠른 연속 이동·끝단 자동스크롤·이탈/복귀·드래그 중 삭제). 페이지 번호 배지가 문서 상단 제목과 약간 겹침(미세 — 필요시 조정).
