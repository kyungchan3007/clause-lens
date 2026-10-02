import { Text, View } from "react-native";
import { Badge, LoadingIndicator, RetryInline } from "@clause-lens/ui";

import { useEntitlementStore } from "../model/entitlementStore";

// 무료 분석 잔량 칩(홈) — FreeQuotaRow와 같은 상태 계약을 압축 표시.
// 미확인·조회 실패를 0으로 대체하지 않는다(서버가 진실). 값 표시는 Badge(info, dot).
export function FreeQuotaChip() {
  const status = useEntitlementStore((s) => s.status);
  const data = useEntitlementStore((s) => s.data);
  const staleError = useEntitlementStore((s) => s.staleError);
  const refresh = useEntitlementStore((s) => s.refresh);

  // idle·최초 확인 전 값 없음 → 숨김(0회로 대체 금지).
  if (status === "idle" && !data) return null;

  if (status === "loading" && !data) {
    return (
      <View className="flex-row items-center gap-1.5 self-start">
        <LoadingIndicator size="small" label="무료 분석 잔량 확인 중" />
      </View>
    );
  }

  if (status === "error" && !data) {
    return (
      <RetryInline
        onRetry={() => void refresh()}
        label="잔량 불러오기 실패 · 다시 시도"
        accessibilityLabel="무료 분석 잔량 다시 불러오기"
        hitSlop={8}
        className="self-start active:opacity-60"
      >
        <Badge label="잔량 불러오기 실패 · 다시 시도" tone="danger" />
      </RetryInline>
    );
  }

  if (!data) return null;
  return (
    <View className="flex-row items-center gap-1.5 self-start">
      <Badge label={`무료 분석 ${data.freeRemaining}회 남음`} tone="info" dot />
      {staleError ? (
        <Text className="text-[11px] text-foreground-muted">최신 확인 실패</Text>
      ) : null}
    </View>
  );
}
