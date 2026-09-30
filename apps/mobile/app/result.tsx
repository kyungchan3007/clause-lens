import { useMemo } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@clause-lens/ui";

import { useAnalysisStore } from "../src/features/analysis";
import { useAuthStore } from "../src/features/auth";
import { ResultScreen, type ResultImage } from "../src/features/result";
import { useUploadStore } from "../src/features/upload";

// app 레이어: 분석 결과 + 업로드 시점 이미지 스냅샷을 결합해 결과 화면에 주입.
// 결과 격리 — 요청 문서 = 분석/업로드 문서 + 현재 사용자 = 업로드 소유자일 때만 표시.
// (페이지 교체·버전 갱신은 TASK-007. 현재 세션은 단일 버전이라 버전 대조는 후속.)
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

  const isolated =
    !!requestedDocId &&
    analysisDocId === requestedDocId &&
    uploadDocId === requestedDocId &&
    !!userId &&
    userId === uploadOwner;

  const imageByPageId = useMemo(() => {
    const map: Record<string, ResultImage | undefined> = {};
    // 스토어 초기화 전 등 방어: pages가 배열이 아닐 수 있으므로 기본값 보장.
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

  if (!isolated || pages.length === 0) {
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
