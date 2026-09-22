import { Alert, Linking } from "react-native";

import { notifyPermissionDenied } from "./permission";

describe("notifyPermissionDenied", () => {
  it("카메라 거부 → '카메라 권한이 필요해요' 안내", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    notifyPermissionDenied("camera");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("카메라 권한이 필요해요");
  });

  it("사진(library) 거부 → '사진 권한이 필요해요' 안내", () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    notifyPermissionDenied("library");
    expect(spy.mock.calls[0][0]).toBe("사진 권한이 필요해요");
  });

  it("'설정 열기'를 누르면 Linking.openSettings 호출", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const openSpy = jest.spyOn(Linking, "openSettings").mockResolvedValue();

    notifyPermissionDenied("camera");
    const buttons = alertSpy.mock.calls[0][2] ?? [];
    const openBtn = buttons.find((b) => b.text === "설정 열기");
    expect(openBtn).toBeDefined();
    openBtn?.onPress?.();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
