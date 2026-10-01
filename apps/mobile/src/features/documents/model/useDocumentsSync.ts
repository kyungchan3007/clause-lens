import { type AnalysisPhase } from "../../analysis";
import { useAccountResourceSync } from "../../../shared/model/useAccountResourceSync";
import { useDocumentsStore } from "./documentsStore";

// 분석이 성공 종결(done|partial)되면 새 문서가 목록에 생겼으니 첫 페이지 갱신.
const refreshOnPhase = (phase: AnalysisPhase): boolean => phase === "done" || phase === "partial";

// 앱 상위 레이어에서 1회 마운트. 기능 간 결합(인증·분석 → 재열람 목록 갱신)을 공통 훅에 위임.
export function useDocumentsSync(): void {
  useAccountResourceSync(useDocumentsStore, { refreshOnPhase });
}
