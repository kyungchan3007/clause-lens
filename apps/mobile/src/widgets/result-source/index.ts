// 결과 경로 판정 위젯 public API — auth·analysis·upload를 조합(app 레이어가 소비).
export { useResultSource } from "./model/useResultSource";
export type { ResultSource } from "./model/useResultSource";
export { isLiveResult, toImageByPageId } from "./lib/resultSource";
