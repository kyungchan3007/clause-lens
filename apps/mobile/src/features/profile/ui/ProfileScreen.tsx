import { ScrollView, Text, View } from "react-native";
import { Icon, IconBadge, ListRow, SectionHeader } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

import { FreeQuotaRow } from "../../entitlement";
import { useProfile } from "../model/useProfile";
import { FaqSection } from "./FaqSection";

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <ListRow
      variant="flat"
      title={label}
      leading={<Icon name={icon} size={20} color={color("textMuted")} />}
      trailing={<Icon name="ChevronRight" size={18} color={color("textMuted")} />}
      onPress={onPress}
    />
  );
}

// 렌더 전용 — 로직은 model/useProfile.
export function ProfileScreen() {
  const { displayName, providerLabel, confirmSignOut, openInquiry } = useProfile();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-10">
      {/* 내 정보 — 흰 블록 중앙 정렬(시안) */}
      <View className="items-center gap-3 bg-surface px-6 pb-6 pt-8">
        <IconBadge name="User" size={36} />
        <View className="items-center gap-1">
          <Text className="text-xl font-extrabold tracking-tight text-foreground">
            {displayName ?? "사용자"}
          </Text>
          {providerLabel ? (
            <Text className="text-sm text-foreground-muted">
              {providerLabel} 계정으로 로그인
            </Text>
          ) : null}
        </View>
      </View>

      {/* 내 이용 — 남은 무료 분석 횟수(서버 값) */}
      <SectionHeader label="내 이용" />
      <FreeQuotaRow />

      {/* 자주 묻는 질문 */}
      <FaqSection />

      {/* 문의 */}
      <SectionHeader label="문의" />
      <View className="border-t border-border">
        <MenuRow
          icon="MessageCircleQuestion"
          label="1:1 문의"
          onPress={openInquiry}
        />
      </View>

      {/* 계정 — 로그아웃은 공용 ListRow(tone=danger). raw Pressable 제거(a11y·일관성). */}
      <SectionHeader label="계정" />
      <View className="border-t border-border">
        <ListRow
          variant="flat"
          tone="danger"
          title="로그아웃"
          leading={<Icon name="LogOut" size={20} color={color("danger")} />}
          onPress={confirmSignOut}
        />
      </View>
    </ScrollView>
  );
}
