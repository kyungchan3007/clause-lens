import type { PageAnalysisResult } from "@clause-lens/contracts";

// 결과 화면에 쓸 업로드 시점 고정 이미지 스냅샷(세션 한정). app 레이어가 주입한다.
export interface ResultImage {
  uri: string;
  width: number;
  height: number;
}

export interface ResultScreenProps {
  // 결과 격리용: app 레이어가 현재 사용자·문서 일치를 확인한 뒤 전달.
  documentId: string;
  pages: PageAnalysisResult[];
  // pageId → 업로드 스냅샷 이미지. 없으면(재진입·세션 만료) 이미지 없이 목록만 표시.
  imageByPageId: Record<string, ResultImage | undefined>;
  onClose?: () => void;
}
