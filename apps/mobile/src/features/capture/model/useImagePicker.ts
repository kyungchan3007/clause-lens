import { useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
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
    if (!permission.granted) return null; // TODO: 설정 이동 안내

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 1 });

    if (result.canceled || result.assets.length === 0) return null;

    const asset = result.assets[0];
    // 최소 유효성: uri 존재. (형식·디코딩 심층 검증은 후속)
    if (!asset.uri) return null;
    return { localUri: asset.uri, width: asset.width, height: asset.height };
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
