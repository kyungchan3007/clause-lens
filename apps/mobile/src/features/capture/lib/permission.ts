import { Alert, Linking } from "react-native";

import type { PickSource } from "../model/useImagePicker";

// 카메라/사진 권한이 거부됐을 때 설정 이동 안내.
// 디바이스 권한 관심사를 캡슐화(UI는 이 함수를 모른다).
export function notifyPermissionDenied(source: PickSource): void {
  const kind = source === "camera" ? "카메라" : "사진";
  Alert.alert(
    `${kind} 권한이 필요해요`,
    `설정에서 ${kind} 접근을 허용해주세요.`,
    [
      { text: "취소", style: "cancel" },
      { text: "설정 열기", onPress: () => void Linking.openSettings() },
    ],
  );
}
