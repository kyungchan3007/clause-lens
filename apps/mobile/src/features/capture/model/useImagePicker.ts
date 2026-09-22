import { useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { normalizeToJpeg } from "../lib/normalizeImage";
import { notifyPermissionDenied } from "../lib/permission";
import { useDraftStore } from "./draftStore";
import type { DraftImageInput } from "./types";

export type PickSource = "camera" | "library";

// 디바이스 API(카메라·갤러리) 격리 훅. UI 는 expo-image-picker 를 직접 모른다.
export function useImagePicker() {
  const addPage = useDraftStore((s) => s.addPage);
  const replacePage = useDraftStore((s) => s.replacePage);

  const pick = useCallback(async (source: PickSource): Promise<DraftImageInput | null> => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notifyPermissionDenied(source); // 설정 이동 안내(무동작 방지)
      return null;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 1 });

    if (result.canceled || result.assets.length === 0) return null;

    const asset = result.assets[0];
    if (!asset.uri) return null;
    // JPEG 정규화 + 실측 크기(HEIC 등 대응). 실패 시 null → 추가 안 함.
    return normalizeToJpeg(asset.uri);
  }, []);

  const captureToDraft = useCallback(
    async (source: PickSource) => {
      const input = await pick(source);
      if (input) addPage(input);
    },
    [pick, addPage],
  );

  const replaceDraft = useCallback(
    async (id: string, source: PickSource) => {
      const input = await pick(source);
      if (input) replacePage(id, input);
    },
    [pick, replacePage],
  );

  return { captureToDraft, replaceDraft };
}
