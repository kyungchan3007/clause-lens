import { HttpError } from "../http";
import { classifyHttpError } from "./httpError";

describe("classifyHttpError", () => {
  it("403은 quota로 분류한다 (무료 소진)", () => {
    expect(classifyHttpError(new HttpError(403))).toBe("quota");
  });

  it("410은 gone으로 분류한다 (보관 경과)", () => {
    expect(classifyHttpError(new HttpError(410))).toBe("gone");
  });

  it("401은 auth로 분류한다 (인증 필요)", () => {
    expect(classifyHttpError(new HttpError(401))).toBe("auth");
  });

  it("409는 conflict로 분류한다 (충돌/중복)", () => {
    expect(classifyHttpError(new HttpError(409))).toBe("conflict");
  });

  it("매핑에 없는 HttpError status는 unknown이다", () => {
    expect(classifyHttpError(new HttpError(500))).toBe("unknown");
    expect(classifyHttpError(new HttpError(404))).toBe("unknown");
    expect(classifyHttpError(new HttpError(400))).toBe("unknown");
  });

  it("HttpError가 아닌 에러(네트워크 등)는 unknown이다", () => {
    expect(classifyHttpError(new Error("network"))).toBe("unknown");
    expect(classifyHttpError("boom")).toBe("unknown");
    expect(classifyHttpError(undefined)).toBe("unknown");
    expect(classifyHttpError(null)).toBe("unknown");
  });
});
