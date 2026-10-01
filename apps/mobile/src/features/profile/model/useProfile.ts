import { useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";

import { useAuthStore } from "../../auth";
import { useEntitlementStore } from "../../entitlement";
import { providerLabelOf } from "../lib/providerLabel";

export interface ProfileModel {
  displayName?: string | null;
  providerLabel: string;
  confirmSignOut: () => void;
  openInquiry: () => void;
}

// 마이페이지 화면 로직 — 사용자 정보·잔량 재조회·로그아웃 확인·문의 안내.
export function useProfile(): ProfileModel {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  // 프로필 포커스마다 서버 잔량 재조회(접수·완료로 바뀌었을 수 있음).
  // 스택 화면은 언마운트되지 않으므로 mount effect가 아니라 focus 기준.
  useFocusEffect(
    useCallback(() => {
      void useEntitlementStore.getState().refresh();
    }, []),
  );

  const confirmSignOut = (): void => {
    Alert.alert("로그아웃", "로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const openInquiry = (): void => {
    Alert.alert("준비 중", "1:1 문의는 곧 제공될 예정이에요.");
  };

  return {
    displayName: user?.displayName,
    providerLabel: providerLabelOf(user?.provider),
    confirmSignOut,
    openInquiry,
  };
}
