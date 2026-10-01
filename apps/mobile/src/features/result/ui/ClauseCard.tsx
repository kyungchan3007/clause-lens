import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { Badge } from "@clause-lens/ui";
import type { Clause } from "@clause-lens/contracts";

import { clauseTypeLabel, riskPresentation } from "../lib/clausePresentation";

interface ClauseCardProps {
  clause: Clause;
  selected: boolean;
  onPress: () => void;
}

// 조항 하나: 제목 + 위험도 배지 + 종류 + 설명 + 근거 원문. 선택 시 테두리로 강조(위험도 색과 별도).
export function ClauseCard({ clause, selected, onPress }: ClauseCardProps) {
  const risk = riskPresentation[clause.riskLevel];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${clause.title}, 위험도 ${risk.label}`}
      onPress={onPress}
      className={`gap-1.5 rounded-xl border p-3 ${
        selected ? "border-primary bg-primary-tint" : "border-border bg-surface"
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-foreground">{clause.title}</Text>
        <Badge label={risk.label} tone={risk.tone} icon={risk.icon} />
      </View>
      <Text className="text-xs text-foreground-muted">{clauseTypeLabel[clause.type]}</Text>
      <Text className="text-sm text-foreground">{clause.description}</Text>
      {clause.sourceText ? (
        <Text className="text-xs text-foreground-muted" numberOfLines={3}>
          “{clause.sourceText}”
        </Text>
      ) : null}
    </Pressable>
  );
}
