// 클라이언트 임시 상태(Draft). 서버 개념(imageKey·revision) 없음 — 순수 로컬.
export interface DraftPage {
  id: string;
  localUri: string;
  order: number;
  width: number;
  height: number;
}

export interface DraftImageInput {
  localUri: string;
  width: number;
  height: number;
}
