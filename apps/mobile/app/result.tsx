import { ActivityIndicator, Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@clause-lens/ui";

import { useDocumentReview, useSaveDocument, type SaveOutcome } from "../src/features/documents";
import { ResultScreen, type ResultScreenProps } from "../src/features/result";
import { SAVE_DOCUMENT_ENABLED } from "../src/shared/config/featureFlags";
import { useResultSource } from "../src/widgets/result-source";

// 저장하기(#163) 배선 — 결과 feature는 표현만, 저장 호출·목록 반영·피드백은 app 레이어.
// 기능 플래그 OFF면 onSave 미주입 → 버튼 미노출(운영 노출 제한). 서버 권한이 실제 경계.
const SAVE_FEEDBACK: Record<SaveOutcome, { title: string; message: string }> = {
  saved: { title: "저장했어요", message: "이제 보관 기간이 지나도 다시 볼 수 있어요." },
  subscription: { title: "구독이 필요해요", message: "장기 보관은 구독 후 이용할 수 있어요." },
  expired: { title: "보관 기간이 지났어요", message: "만료된 결과는 저장할 수 없어요." },
  conflict: { title: "저장할 수 없어요", message: "완료된 분석만 저장할 수 있어요." },
  error: { title: "저장에 실패했어요", message: "잠시 후 다시 시도해 주세요." },
};

function SaveableResult(props: Omit<ResultScreenProps, "onSave" | "saving">) {
  const { save, saving } = useSaveDocument(props.documentId);
  const onSave = SAVE_DOCUMENT_ENABLED
    ? () => {
        void (async () => {
          const outcome = await save();
          const f = SAVE_FEEDBACK[outcome];
          Alert.alert(f.title, f.message);
        })();
      }
    : undefined;
  return <ResultScreen {...props} onSave={onSave} saving={saving} />;
}

// 라우트는 얇게 — 경로 판정은 widgets/result-source 훅, 여기선 렌더·네비게이션만.
//  (a) live = 방금 분석한 문서(메모리 스냅샷·이미지 포함, 격리 경로)
//  (b) review = 그 외(최근 목록에서 재열람, 서버에서 조항 재조회·이미지=후속)
export default function ResultRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ documentId?: string }>();
  const requestedDocId =
    typeof params.documentId === "string" ? params.documentId : undefined;
  const source = useResultSource(requestedDocId);

  if (source.kind === "live") {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <SaveableResult
          documentId={source.documentId}
          pages={source.pages}
          imageByPageId={source.imageByPageId}
          onClose={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (source.kind === "review") {
    return <ReviewResult documentId={source.documentId} onClose={() => router.back()} />;
  }

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center gap-3 bg-background px-4"
      edges={["top", "bottom"]}
    >
      <Text className="text-center text-sm text-foreground-muted">
        결과를 불러올 수 없어요. 분석을 다시 시작해 주세요.
      </Text>
      <Button label="돌아가기" variant="secondary" onPress={() => router.back()} />
    </SafeAreaView>
  );
}

// 재열람(조항): 서버에서 결과를 다시 받아 표시. 이미지 하이라이트 복원은 후속 — 조항 목록만.
function ReviewResult({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const { state, pages, reload } = useDocumentReview(documentId);

  if (state === "loading") {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        edges={["top", "bottom"]}
      >
        <ActivityIndicator accessibilityLabel="불러오는 중" />
      </SafeAreaView>
    );
  }

  if (state === "gone") {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center gap-3 bg-background px-6"
        edges={["top", "bottom"]}
      >
        <Text className="text-center text-base font-medium text-foreground">
          보관 기간이 지났어요
        </Text>
        <Text className="text-center text-sm text-foreground-muted">
          무료 분석 결과는 7일 동안 보관돼요. 다시 보려면 새로 분석해 주세요.
        </Text>
        <Button label="돌아가기" variant="secondary" onPress={onClose} />
      </SafeAreaView>
    );
  }

  if (state === "error" || pages.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center gap-3 bg-background px-6"
        edges={["top", "bottom"]}
      >
        <Text className="text-center text-sm text-foreground-muted">
          결과를 불러오지 못했어요.
        </Text>
        <View className="flex-row gap-2">
          <Button label="다시 시도" variant="primary" onPress={reload} />
          <Button label="돌아가기" variant="secondary" onPress={onClose} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <SaveableResult
        documentId={documentId}
        pages={pages}
        imageByPageId={{}}
        onClose={onClose}
      />
    </SafeAreaView>
  );
}
