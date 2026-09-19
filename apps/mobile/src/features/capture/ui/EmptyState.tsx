import { View, Text } from "react-native";
import { Button, IconBadge } from "@clause-lens/ui";
import { useImagePicker } from "../model/useImagePicker";

export function EmptyState() {
  const { captureToDraft } = useImagePicker();

  return (
    <View className="flex-1 items-center justify-center px-6">
      <IconBadge name="FileText" size={36} className="mb-5" />
      <Text className="text-lg font-medium text-foreground">계약서를 담아주세요</Text>
      <Text className="mb-8 mt-1.5 text-center text-sm text-foreground-muted">
        촬영하거나 갤러리에서 불러올 수 있어요
      </Text>
      <View className="w-full gap-3">
        <Button label="촬영하기" variant="primary" onPress={() => captureToDraft("camera")} />
        <Button label="갤러리에서 선택" variant="secondary" onPress={() => captureToDraft("library")} />
      </View>
    </View>
  );
}
