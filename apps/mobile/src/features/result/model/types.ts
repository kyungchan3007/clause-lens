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
  // 장기 보관 전환(저장하기, #163). app 레이어가 주입할 때만 저장 버튼 노출(기능 플래그로 제어).
  // 저장 호출·목록 반영·피드백은 app 레이어가 담당(결과 feature는 표현만).
  onSave?: () => void;
  saving?: boolean; // 저장 진행 중(버튼 비활성·라벨 전환)
}
