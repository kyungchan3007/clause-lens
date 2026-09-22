import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@clause-lens/ui";
import { semantic } from "@clause-lens/tokens";

import { CaptureScreen, useDraftStore } from "../src/features/capture";
import {
  useUpload,
  useUploadStore,
  type GetUploadAuth,
  type UploadPageSnapshot,
} from "../src/features/upload";
import { getAccessToken, useAuthStore } from "../src/features/auth";

const ACTIVE_PHASES = ["presigning", "uploading", "confirming"];

// 라우트는 얇게 — app 레이어에서 capture·upload·auth를 조합(FSD: 상위 레이어 조합).
export default function Page() {
  const router = useRouter();
  const setLocked = useDraftStore((s) => s.setLocked);
  const userId = useAuthStore((s) => s.user?.id);

  const { start, retry, cancel } = useUpload();
  const phase = useUploadStore((s) => s.phase);
  const sentCount = useUploadStore((s) => s.sentCount);
  const totalCount = useUploadStore((s) => s.totalCount);
  const message = useUploadStore((s) => s.message);
  const ownerUserId = useUploadStore((s) => s.ownerUserId);

  const active = ACTIVE_PHASES.includes(phase);

  // 업로드 진행 중엔 Draft 편집 잠금(스냅샷 불변성).
  useEffect(() => {
    setLocked(active);
  }, [active, setLocked]);

  // 계정 변경(로그아웃/전환) 시 진행 중 업로드 즉시 무효화.
  useEffect(() => {
    if (active && ownerUserId && userId !== ownerUserId) {
      cancel();
    }
  }, [active, ownerUserId, userId, cancel]);

  // 호출 직전 토큰·소유자 취득(장기 캡처 금지).
  const getAuth: GetUploadAuth = async () => {
    const token = await getAccessToken();
    const currentUserId = useAuthStore.getState().user?.id;
    return token && currentUserId
      ? { accessToken: token, userId: currentUserId }
      : null;
  };

  const snapshots = (): UploadPageSnapshot[] =>
    useDraftStore.getState().pages.map((p) => ({
      draftId: p.id,
      localUri: p.localUri,
      order: p.order,
      contentType: p.contentType,
      sizeBytes: p.sizeBytes,
      width: p.width,
      height: p.height,
    }));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-end px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="마이페이지"
          onPress={() => router.push("/profile")}
          hitSlop={12}
          className="p-1 active:opacity-60"
        >
          <Icon name="User" size={24} color={semantic.light.text} />
        </Pressable>
      </View>
      <CaptureScreen
        analyze={{
          phase,
          sentCount,
          totalCount,
          message,
          onAnalyze: () => void start(snapshots(), getAuth),
          onRetry: () => void retry(snapshots(), getAuth),
          onCancel: cancel,
        }}
      />
    </SafeAreaView>
  );
}
