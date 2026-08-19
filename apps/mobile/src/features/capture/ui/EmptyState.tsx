import { View, Text } from "react-native";
import { Button, Icon } from "@clause-lens/ui";
import { useImagePicker } from "../model/useImagePicker";

export function EmptyState() {
  const { captureToDraft } = useImagePicker();

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-primary-tint">
        <Icon name="FileText" size={36} color="#2563EB" />
      </View>
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
