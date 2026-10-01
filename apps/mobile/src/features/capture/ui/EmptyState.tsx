import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Button, EmptyState as UiEmptyState } from "@clause-lens/ui";
import { useImagePicker } from "../model/useImagePicker";

// 표시부는 공용 EmptyState, 화면 배치(중앙/스크롤)·picker 훅·버튼 동작은 capture가 소유.
// extra: 담긴 페이지가 없을 때 홈 하단에 끼울 콘텐츠(최근 분석 등). app 레이어가 주입.
export function EmptyState({ extra }: { extra?: ReactNode }) {
  const { captureToDraft } = useImagePicker();

  const hero = (
    <UiEmptyState
      icon="FileText"
      title="계약서를 담아주세요"
      subtitle="촬영하거나 갤러리에서 불러올 수 있어요"
      actions={
        <>
          <Button label="촬영하기" variant="primary" onPress={() => captureToDraft("camera")} />
          <Button label="갤러리에서 선택" variant="secondary" onPress={() => captureToDraft("library")} />
        </>
      }
    />
  );

  // 최근 분석 등 추가 콘텐츠가 있으면 스크롤 레이아웃(히어로 상단 + 하단 섹션).
  if (extra) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pb-8 pt-10">{hero}</View>
        {extra}
      </ScrollView>
    );
  }

  return <View className="flex-1 justify-center">{hero}</View>;
}
