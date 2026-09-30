import * as React from "react";
import { View } from "react-native";
import type { Clause } from "@clause-lens/contracts";

import { ClauseCard } from "./ClauseCard";

interface ClauseListProps {
  clauses: Clause[];
  selectedClauseId: string | null;
  onSelect: (clauseId: string) => void;
}

export function ClauseList({ clauses, selectedClauseId, onSelect }: ClauseListProps) {
  return (
    <View className="gap-2 px-4">
      {clauses.map((clause) => (
        <ClauseCard
          key={clause.id}
          clause={clause}
          selected={clause.id === selectedClauseId}
          onPress={() => onSelect(clause.id)}
        />
      ))}
    </View>
  );
}
