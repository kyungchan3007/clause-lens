import { useEffect } from "react";

import { useAuthStore } from "../../auth";
import { useAnalysisStore } from "../../analysis";
import { useDocumentsStore } from "./documentsStore";

// 앱 상위 레이어에서 1회 마운트. 기능 간 결합(인증·분석 → 재열람 목록 갱신)을 여기 한 곳에.
export function useDocumentsSync(): void {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // 인증: 로그인·계정 변경 → 동기화 + 조회 / 로그아웃 → 초기화(이전 사용자 목록 미노출).
  useEffect(() => {
    const store = useDocumentsStore.getState();
    if (status === "authenticated") {
      store.syncAccount(userId);
      void store.refresh();
    } else if (status === "unauthenticated") {
      store.syncAccount(null);
    }
  }, [status, userId]);

  // 분석이 성공 종결(done|partial)되면 새 문서가 목록에 생겼으니 첫 페이지 갱신.
  const phase = useAnalysisStore((s) => s.phase);
  useEffect(() => {
    if (phase === "done" || phase === "partial") {
      void useDocumentsStore.getState().refresh();
    }
  }, [phase]);
}
