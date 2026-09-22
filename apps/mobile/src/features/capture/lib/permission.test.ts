import { Alert, Linking } from "react-native";

import { notifyPermissionDenied } from "./permission";

// Alert 목: 표시 즉시 onDismiss를 호출해 내부 중복방지 플래그를 리셋(테스트 격리).
function mockAlertAutoDismiss() {
  return jest
    .spyOn(Alert, "alert")
    .mockImplementation(((...args: unknown[]) => {
      const opts = args[3] as { onDismiss?: () => void } | undefined;
      opts?.onDismiss?.();
    }) as unknown as typeof Alert.alert);
}

type Btn = { text?: string; onPress?: () => void };
function buttonsOf(spy: jest.SpyInstance): Btn[] {
  return (spy.mock.calls[0]?.[2] as Btn[]) ?? [];
}

describe("notifyPermissionDenied", () => {
  it("카메라 거부 → '카메라 권한이 필요해요' 안내", () => {
    const spy = mockAlertAutoDismiss();
    notifyPermissionDenied("camera");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("카메라 권한이 필요해요");
  });

  it("사진(library) 거부 → '사진 권한이 필요해요' 안내", () => {
    const spy = mockAlertAutoDismiss();
    notifyPermissionDenied("library");
    expect(spy.mock.calls[0][0]).toBe("사진 권한이 필요해요");
  });

  it("'설정 열기'를 누르면 Linking.openSettings 호출", () => {
    const alertSpy = mockAlertAutoDismiss();
    const openSpy = jest.spyOn(Linking, "openSettings").mockResolvedValue();

    notifyPermissionDenied("camera");
    const openBtn = buttonsOf(alertSpy).find((b) => b.text === "설정 열기");
    expect(openBtn).toBeDefined();
    openBtn?.onPress?.();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it("이미 표시 중이면 중복 호출 무시(다이얼로그 중첩 방지)", () => {
    // dismiss 하지 않는 목 → 표시 상태 유지
    const spy = jest.spyOn(Alert, "alert").mockImplementation((() => {}) as unknown as typeof Alert.alert);
    notifyPermissionDenied("camera");
    notifyPermissionDenied("camera"); // 두 번째는 가드로 무시
    expect(spy).toHaveBeenCalledTimes(1);
    // 정리: 취소 버튼으로 내부 플래그 리셋(다음 테스트 격리)
    buttonsOf(spy).find((b) => b.text === "취소")?.onPress?.();
  });

  it("openSettings가 실패해도 예외를 전파하지 않음", async () => {
    const alertSpy = mockAlertAutoDismiss();
    jest.spyOn(Linking, "openSettings").mockRejectedValue(new Error("no settings"));

    notifyPermissionDenied("camera");
    const openBtn = buttonsOf(alertSpy).find((b) => b.text === "설정 열기");
    expect(() => openBtn?.onPress?.()).not.toThrow();
    await Promise.resolve(); // microtask flush — catch로 삼켜져 unhandled rejection 없음
  });
});
