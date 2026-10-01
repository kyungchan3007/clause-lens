import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@clause-lens/ui";

import { useAnalysisStore } from "../src/features/analysis";
import { useAuthStore } from "../src/features/auth";
import { useDocumentReview } from "../src/features/documents";
import { ResultScreen, type ResultImage } from "../src/features/result";
import { useUploadStore } from "../src/features/upload";

// app 레이어: 두 경로를 조합한다.
//  (a) 방금 분석한 문서 = 메모리 스냅샷(이미지 포함) 결과(기존 격리 경로).
//  (b) 그 외(최근 목록에서 재열람) = 서버에서 조항을 다시 받아 표시(조항 재열람, 이미지=후속).
export default function ResultRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ documentId?: string }>();
  const requestedDocId =
    typeof params.documentId === "string" ? params.documentId : undefined;

  const userId = useAuthStore((s) => s.user?.id);
  const analysisDocId = useAnalysisStore((s) => s.documentId);
  const pages = useAnalysisStore((s) => s.pages);
  const uploadDocId = useUploadStore((s) => s.documentId);
  const uploadOwner = useUploadStore((s) => s.ownerUserId);
  const uploadPages = useUploadStore((s) => s.pages);

  // 방금 분석한 문서인가(메모리 스냅샷 + 소유자 일치) — 이미지 포함 결과.
  const isLive =
    !!requestedDocId &&
    analysisDocId === requestedDocId &&
    uploadDocId === requestedDocId &&
    !!userId &&
    userId === uploadOwner &&
    pages.length > 0;

  const imageByPageId = useMemo(() => {
    const map: Record<string, ResultImage | undefined> = {};
    for (const p of uploadPages ?? []) {
      if (p.pageId && p.image) {
        map[p.pageId] = {
          uri: p.image.localUri,
          width: p.image.width,
          height: p.image.height,
        };
      }
    }
    return map;
  }, [uploadPages]);

  if (isLive) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ResultScreen
          documentId={requestedDocId}
          pages={pages}
          imageByPageId={imageByPageId}
          onClose={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (requestedDocId) {
    return <ReviewResult documentId={requestedDocId} onClose={() => router.back()} />;
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
      <ResultScreen
        documentId={documentId}
        pages={pages}
        imageByPageId={{}}
        onClose={onClose}
      />
    </SafeAreaView>
  );
}
