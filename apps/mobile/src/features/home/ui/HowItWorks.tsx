import { Text, View } from "react-native";
import { Icon, type IconName } from "@clause-lens/ui";
import { color } from "@clause-lens/tokens";

// 3단계 안내(홈 전용). 좁은 폭·큰 글자에서 세로로 줄바꿈되게 flex-wrap.
const STEPS: { icon: IconName; title: string; sub: string }[] = [
  { icon: "Camera", title: "촬영", sub: "여러 장도 OK" },
  { icon: "Sparkles", title: "분석", sub: "서버에서" },
  { icon: "FileText", title: "하이라이트", sub: "사진 위 표시" },
];

export function HowItWorks() {
  return (
    <View className="flex-row flex-wrap gap-2 px-5 pt-5">
      {STEPS.map((s) => (
        <View
          key={s.title}
          className="min-w-[90px] flex-1 items-center rounded-2xl border border-border bg-surface-alt px-2 py-3.5"
        >
          <View className="mb-2 h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface">
            <Icon name={s.icon} size={16} color={color("primary")} />
          </View>
          <Text className="text-[12.5px] font-bold text-foreground">{s.title}</Text>
          <Text className="mt-0.5 text-[11px] text-foreground-muted">{s.sub}</Text>
        </View>
      ))}
    </View>
  );
}
