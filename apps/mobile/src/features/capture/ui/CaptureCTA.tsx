import { View } from "react-native";
import { Button } from "@clause-lens/ui";
import { useImagePicker } from "../model/useImagePicker";

// 촬영·갤러리 CTA — capture가 picker 훅을 소유. app 레이어가 홈 상태에 맞게 배치.
export function CaptureCTA() {
  const { captureToDraft } = useImagePicker();
  return (
    <View className="w-full gap-3">
      <Button
        label="계약서 촬영"
        variant="primary"
        size="lg"
        icon="Camera"
        onPress={() => captureToDraft("camera")}
      />
      <Button
        label="갤러리에서 선택"
        variant="ghost"
        icon="Images"
        onPress={() => captureToDraft("library")}
      />
    </View>
  );
}
