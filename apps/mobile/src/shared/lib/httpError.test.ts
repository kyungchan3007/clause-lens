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

  it("instanceof 실패(크로스모듈)에도 numeric status 객체를 구조적으로 분류한다", () => {
    // 번들 경계로 생성자가 달라 instanceof가 실패해도 status로 폴백.
    expect(classifyHttpError({ status: 403 })).toBe("quota");
    expect(classifyHttpError({ status: 410 })).toBe("gone");
    expect(classifyHttpError({ status: 401 })).toBe("auth");
    expect(classifyHttpError({ status: 409 })).toBe("conflict");
    expect(classifyHttpError({ status: 500 })).toBe("unknown");
    // status가 없거나 숫자가 아니면 unknown.
    expect(classifyHttpError({ code: "x" })).toBe("unknown");
    expect(classifyHttpError({ status: "401" })).toBe("unknown");
  });
});
