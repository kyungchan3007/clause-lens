import { type AnalysisPhase } from "../../analysis";
import { useAccountResourceSync } from "../../../shared/model/useAccountResourceSync";
import { useEntitlementStore } from "./entitlementStore";

// 분석 phase 변화 → 접수(analyzing)·terminal(done/partial/failed)·오류(403 포함)에서 재조회.
// idle/requesting은 제외. 접수 성공 시 예약으로, 완료 시 확정/해제로 잔량이 바뀐다.
const refreshOnPhase = (phase: AnalysisPhase): boolean => phase !== "idle" && phase !== "requesting";

// 앱 상위 레이어에서 1회 마운트. 기능 간 결합(인증·분석 → 자격 갱신)을 공통 훅에 위임.
// 잔량은 terminal뿐 아니라 접수(예약) 시점에도 변하므로, 분석 phase 변화에서도 재조회한다.
export function useEntitlementSync(): void {
  useAccountResourceSync(useEntitlementStore, { refreshOnPhase });
}
