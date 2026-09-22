import { mapLoginError } from "./loginError";

describe("mapLoginError", () => {
  it("사용자 취소(code) → null (문구 미표시)", () => {
    expect(mapLoginError({ code: "E_CANCELLED_OPERATION" })).toBeNull();
    expect(mapLoginError({ code: "USER_CANCELLED" })).toBeNull();
  });

  it("사용자 취소(message) → null", () => {
    expect(mapLoginError(new Error("user cancelled login"))).toBeNull();
    expect(mapLoginError(new Error("사용자가 취소했습니다"))).toBeNull();
  });

  it("네트워크 오류 → 네트워크 문구", () => {
    expect(mapLoginError(new TypeError("Network request failed"))).toBe(
      "네트워크 연결을 확인해주세요",
    );
    expect(mapLoginError(new Error("network error"))).toBe(
      "네트워크 연결을 확인해주세요",
    );
  });

  it("서버 오류·env 누락·알 수 없음 → 일반 실패 문구(원문 미노출)", () => {
    const generic = "로그인에 실패했어요. 잠시 후 다시 시도해주세요";
    expect(mapLoginError(new Error("카카오 로그인 실패 (500)"))).toBe(generic);
    expect(mapLoginError(new Error("EXPO_PUBLIC_API_BASE_URL 누락"))).toBe(generic);
    expect(mapLoginError("문자열 에러")).toBe(generic);
    expect(mapLoginError(undefined)).toBe(generic);
  });
});
