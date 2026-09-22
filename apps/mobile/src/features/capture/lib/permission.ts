import { Alert, Linking } from "react-native";

import type { PickSource } from "../model/useImagePicker";

// 이미 안내가 떠 있으면 재노출하지 않는다(빠른 연속 탭 → 다이얼로그 중첩 방지).
let alertVisible = false;

function resetAlert(): void {
  alertVisible = false;
}

async function openSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // 설정 열기 실패는 치명적이지 않아 조용히 무시(unhandled rejection 방지, 원문 로깅 안 함).
  }
}

// 카메라/사진 권한이 거부됐을 때 설정 이동 안내.
// 디바이스 권한 관심사를 캡슐화(UI는 이 함수를 모른다).
export function notifyPermissionDenied(source: PickSource): void {
  if (alertVisible) return;
  alertVisible = true;

  const kind = source === "camera" ? "카메라" : "사진";
  Alert.alert(
    `${kind} 권한이 필요해요`,
    `설정에서 ${kind} 접근을 허용해주세요.`,
    [
      { text: "취소", style: "cancel", onPress: resetAlert },
      {
        text: "설정 열기",
        onPress: () => {
          resetAlert();
          void openSettings();
        },
      },
    ],
    { onDismiss: resetAlert }, // Android 백버튼 등으로 닫힐 때
  );
}
