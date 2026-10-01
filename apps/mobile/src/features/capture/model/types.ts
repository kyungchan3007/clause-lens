// 클라이언트 임시 상태(Draft). 서버 개념(pageId·documentId) 없음 — 순수 로컬.
// contentType·sizeBytes는 로컬 파일 사실(정규화 결과) — 업로드 presign에 그대로 사용.
export interface DraftPage {
  id: string;
  localUri: string;
  // 표시용 축소 썸네일 URI(그리드 렌더 메모리 절감). 업로드엔 쓰지 않음(localUri 사용).
  thumbUri: string;
  order: number;
  width: number;
  height: number;
  contentType: string; // 정규화 후 MIME(예: image/jpeg)
  sizeBytes: number; // 정규화 후 실측 바이트
}

export interface DraftImageInput {
  localUri: string;
  thumbUri: string;
  width: number;
  height: number;
  contentType: string;
  sizeBytes: number;
}
