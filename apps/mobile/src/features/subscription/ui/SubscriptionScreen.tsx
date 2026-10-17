import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, LoadingIndicator, MessageState, Notice } from "@clause-lens/ui";

import { useSubscriptionStore } from "../model/subscriptionStore";

// 구독 화면(#165 Slice 4B). placeholder 교체. "서버가 진실" — 구매 성공과 권한을 분리 표시.
export function SubscriptionScreen() {
  const offeringsStatus = useSubscriptionStore((s) => s.offeringsStatus);
  const plans = useSubscriptionStore((s) => s.plans);
  const flow = useSubscriptionStore((s) => s.flow);
  const inFlight = useSubscriptionStore((s) => s.inFlight);
  const loadOfferings = useSubscriptionStore((s) => s.loadOfferings);
  const purchase = useSubscriptionStore((s) => s.purchase);
  const restore = useSubscriptionStore((s) => s.restore);
  const recheck = useSubscriptionStore((s) => s.recheck);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const busy = inFlight || flow === "purchasing" || flow === "restoring" || flow === "confirming";

  return (
    <ScrollView contentContainerClassName="gap-4 p-4" testID="subscription-screen">
      <View className="gap-1">
        <Text className="text-xl font-bold text-foreground">프로 구독</Text>
        <Text className="text-[13px] leading-5 text-foreground-muted">
          구독하면 분석 결과를 기한 없이 보관하고 매달 더 많은 분석을 할 수 있어요.
        </Text>
      </View>

      <FlowBanner flow={flow} onRecheck={recheck} busy={busy} />

      {offeringsStatus === "loading" ? (
        <LoadingIndicator label="상품을 불러오는 중…" />
      ) : offeringsStatus === "error" ? (
        <MessageState
          tone="danger"
          title="상품을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          actions={<Button label="다시 시도" variant="secondary" onPress={() => void loadOfferings()} />}
        />
      ) : (
        <View className="gap-3">
          {plans.map((plan) => (
            <View key={plan.id} className="gap-2 rounded-2xl border border-border p-4">
              <Text className="text-[15px] font-bold text-foreground">{plan.title}</Text>
              <Text className="text-[13px] text-foreground-muted">{plan.priceLabel}</Text>
              <Button
                label="구독하기"
                variant="primary"
                fullWidth
                disabled={busy}
                onPress={() => void purchase(plan.id)}
              />
            </View>
          ))}
        </View>
      )}

      <Button label="구매 복원" variant="ghost" fullWidth disabled={busy} onPress={() => void restore()} />
    </ScrollView>
  );
}

// 구매↔권한 분리 상태를 정직하게 — 완료 단정 금지.
function FlowBanner({
  flow,
  onRecheck,
  busy,
}: {
  flow: ReturnType<typeof useSubscriptionStore.getState>["flow"];
  onRecheck: () => void;
  busy: boolean;
}) {
  switch (flow) {
    case "purchasing":
    case "restoring":
      return <Notice tone="info" icon="RefreshCw">스토어에서 처리 중이에요…</Notice>;
    case "confirming":
      return <Notice tone="info" icon="RefreshCw">구매를 확인하고 있어요. 잠시만요…</Notice>;
    case "active":
      return <Notice tone="success" icon="ShieldCheck">구독이 활성화되어 보관 권한이 생겼어요.</Notice>;
    case "delayed":
      return (
        <MessageState
          tone="default"
          icon="FileClock"
          title="확인이 지연되고 있어요"
          description="스토어 결제는 완료됐어요. 서버 반영 확인이 지연 중이라 잠시 후 다시 확인해 주세요."
          actions={<Button label="다시 확인" variant="secondary" disabled={busy} onPress={onRecheck} />}
        />
      );
    case "no_target":
      return <Notice tone="neutral" icon="Info">복원할 구매가 없어요.</Notice>;
    case "conflict":
      return (
        <MessageState
          tone="default"
          icon="Info"
          title="구매를 연결하지 못했어요"
          description="현재 계정에서 구매를 연결하지 못했어요. 구매에 사용한 계정으로 로그인하거나 고객지원에 문의해 주세요."
        />
      );
    case "error":
      return (
        <MessageState
          tone="danger"
          title="처리 중 문제가 생겼어요"
          description="잠시 후 다시 시도해 주세요."
        />
      );
    default:
      return null;
  }
}
