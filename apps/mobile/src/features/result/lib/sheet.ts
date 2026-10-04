// 결과 화면 "전체 보기" 시트 전용 순수 로직(렌더와 분리해 단위 검증).
// 스냅: 0=collapsed(이미지+요약), 1=full(전체화면 조항).

export const SHEET_COLLAPSED = 0;
export const SHEET_FULL = 1;

// full에서 조항 탭 → 접으며 이미지에서 강조. 단, 오버레이(이미지·좌표)가 없으면 접지 않는다
// (접어도 강조를 볼 수 없으니 연속 읽기를 끊지 않음 — Codex 설계).
export function shouldCollapseOnClauseTap(params: {
  snapIndex: number;
  overlayEnabled: boolean;
}): boolean {
  return params.snapIndex === SHEET_FULL && params.overlayEnabled;
}

// collapsed에서 시트가 차지할 비율(occupy 0..1) — 이미지 카드 아래에서 시작하도록 계산.
// contentHeight: 헤더·푸터 제외 콘텐츠 영역 높이, imageCardHeight: 이미지 카드(여백 포함) 높이.
export function computeCollapsedOccupy(params: {
  contentHeight: number;
  imageCardHeight: number;
}): number {
  const { contentHeight, imageCardHeight } = params;
  if (contentHeight <= 0) return 0.55; // 측정 전 기본값
  const occupy = 1 - (imageCardHeight + 8) / contentHeight;
  return Math.min(0.72, Math.max(0.32, occupy));
}

// Android 뒤로가기: full이면 collapsed로(소비), 아니면 기본 동작(미소비).
// 반환 true면 이벤트를 소비(화면 이탈 막음).
export function handleBackPress(params: {
  showSheet: boolean;
  snapIndex: number;
  collapse: () => void;
}): boolean {
  if (params.showSheet && params.snapIndex === SHEET_FULL) {
    params.collapse();
    return true;
  }
  return false;
}
