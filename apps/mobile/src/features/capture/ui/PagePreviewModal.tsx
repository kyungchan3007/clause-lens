import { Modal, View, Text, Image, Pressable } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Button, Icon } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";
import type { DraftPage } from "../model/types";

interface PagePreviewModalProps {
  page: DraftPage | null; // null이면 닫힘
  index: number; // 0-based (표시용 "N페이지")
  disabled?: boolean; // locked/dragging 시 교체·삭제 비활성
  onClose: () => void;
  onReplace: (id: string) => void;
  onDelete: (id: string) => void;
}

// 카드 탭 시 전체화면 확대 미리보기 + "이 페이지 교체"·"삭제". 교체는 id·order 유지, 취소=무변경.
export function PagePreviewModal({
  page,
  index,
  disabled,
  onClose,
  onReplace,
  onDelete,
}: PagePreviewModalProps) {
  return (
    <Modal
      visible={page != null}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      {/* Modal은 별도 네이티브 루트라 바깥 SafeAreaProvider inset이 안 닿음 → 모달 안에서 다시 제공. */}
      <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        {page ? (
          <View className="flex-1">
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text className="text-base font-bold text-foreground">{index + 1}페이지</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="닫기"
                className="h-11 w-11 items-center justify-center"
              >
                <Icon name="X" size={22} color={color("text")} />
              </Pressable>
            </View>

            <View className="flex-1 bg-surface-alt">
              <Image
                source={{ uri: page.localUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>

            <View className="gap-2 px-4 pb-2 pt-3">
              <Button
                label="이 페이지 교체"
                variant="secondary"
                icon="RefreshCw"
                disabled={disabled}
                onPress={() => onReplace(page.id)}
              />
              <Button
                label="삭제"
                variant="ghost"
                disabled={disabled}
                onPress={() => onDelete(page.id)}
              />
            </View>
          </View>
        ) : null}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
