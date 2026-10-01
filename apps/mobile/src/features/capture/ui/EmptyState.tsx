import type { ReactNode } from "react";
import { ScrollView, View, Text } from "react-native";
import { Button, IconBadge } from "@clause-lens/ui";
import { useImagePicker } from "../model/useImagePicker";

// extra: 홈 하단에 끼울 선택 콘텐츠(최근 분석 등). app 레이어가 주입 — capture는 내용을 모른다.
export function EmptyState({ extra }: { extra?: ReactNode }) {
  const { captureToDraft } = useImagePicker();

  const hero = (
    <>
      <IconBadge name="FileText" size={36} className="mb-5" />
      <Text className="text-lg font-medium text-foreground">계약서를 담아주세요</Text>
      <Text className="mb-8 mt-1.5 text-center text-sm text-foreground-muted">
        촬영하거나 갤러리에서 불러올 수 있어요
      </Text>
      <View className="w-full gap-3">
        <Button label="촬영하기" variant="primary" onPress={() => captureToDraft("camera")} />
        <Button label="갤러리에서 선택" variant="secondary" onPress={() => captureToDraft("library")} />
      </View>
    </>
  );

  // 최근 분석 등 추가 콘텐츠가 있으면 스크롤 레이아웃(히어로 상단 + 하단 섹션).
  if (extra) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center px-6 pb-8 pt-10">{hero}</View>
        {extra}
      </ScrollView>
    );
  }

  return <View className="flex-1 items-center justify-center px-6">{hero}</View>;
}
