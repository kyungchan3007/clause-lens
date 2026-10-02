import { Text, View } from "react-native";
import { Icon, LoadingIndicator, RetryInline } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

import { useEntitlementStore } from "../model/entitlementStore";

// 남은 무료 분석 횟수 표시(서버 값). 로딩·실패 상태 포함, 0회로 대체하지 않는다.
export function FreeQuotaRow() {
  const status = useEntitlementStore((s) => s.status);
  const data = useEntitlementStore((s) => s.data);
  const staleError = useEntitlementStore((s) => s.staleError);
  const refresh = useEntitlementStore((s) => s.refresh);

  return (
    <View
      accessibilityRole="summary"
      className="min-h-[56px] flex-row items-center gap-3 border-y border-border bg-surface px-4"
    >
      <Icon name="Ticket" size={20} color={color("textMuted")} />
      <Text className="flex-1 text-base text-foreground">남은 무료 분석</Text>

      {status === "loading" ? (
        <LoadingIndicator label="불러오는 중" />
      ) : status === "error" ? (
        <RetryInline onRetry={() => void refresh()} label="불러오지 못했어요 · 다시 시도" />
      ) : data ? (
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-foreground">
            {data.freeRemaining}회
          </Text>
          {staleError ? (
            <Text className="text-xs text-foreground-muted">최신 확인 실패</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
