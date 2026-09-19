import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
} from "react-native";
import { Icon, SectionHeader } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";

import { FAQ_ITEMS } from "../model/faq";

// Android에서 LayoutAnimation 활성화(펼침/접힘 부드럽게).
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <View>
      <SectionHeader label="자주 묻는 질문" />
      <View className="border-t border-border">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <View key={item.q} className="border-b border-border bg-surface">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => toggle(index)}
                className="min-h-[56px] flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt"
              >
                <Text className="flex-1 text-base text-foreground">{item.q}</Text>
                <Icon
                  name={isOpen ? "ChevronUp" : "ChevronDown"}
                  size={18}
                  color={semantic.light.textMuted}
                />
              </Pressable>
              {isOpen ? (
                <View className="px-4 pb-4">
                  <Text className="text-sm leading-6 text-foreground-muted">
                    {item.a}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
