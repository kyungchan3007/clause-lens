import {
  HttpError,
  authedGet,
  authedPost,
  baseUrl,
  configureAuthGateway,
} from "./client";

// EXPO_PUBLIC_API_BASE_URL은 jest.setup.js에서 http://localhost:3000으로 설정됨.
const BASE = "http://localhost:3000";

const okJson = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;
const errStatus = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as Response;

// 구조적 Parser — 통과/실패를 제어해 schema.parse 호출을 검증.
const passthrough = { parse: (d: unknown) => d };
const rejecting = {
  parse: () => {
    throw new Error("schema rejected");
  },
};

describe("client.baseUrl", () => {
  it("설정된 base URL을 반환", () => {
    expect(baseUrl()).toBe(BASE);
  });
});

describe("client.authedGet", () => {
  afterEach(() => jest.restoreAllMocks());

  it("Authorization 헤더로 GET하고 응답을 schema.parse", async () => {
    const spy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(okJson({ ok: 1 }));
    const parse = jest.fn((d: unknown) => d);
    const r = await authedGet("/me/thing", "tkn", { parse });

    expect(r).toEqual({ ok: 1 });
    expect(parse).toHaveBeenCalledWith({ ok: 1 });
    expect(spy.mock.calls[0][0]).toBe(`${BASE}/me/thing`);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tkn",
    );
    expect(init.method).toBeUndefined(); // GET(기본 메서드)
  });

  it("non-ok → HttpError(status), schema.parse 미호출", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(410));
    await expect(authedGet("/x", "t", rejecting)).rejects.toBeInstanceOf(
      HttpError,
    );
    await authedGet("/x", "t", rejecting).catch((e) =>
      expect((e as HttpError).status).toBe(410),
    );
  });

  it("schema가 거부하면 그 에러를 전파", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(okJson({ bad: true }));
    await expect(authedGet("/x", "t", rejecting)).rejects.toThrow(
      /schema rejected/,
    );
  });
});

describe("client.authedPost", () => {
  afterEach(() => jest.restoreAllMocks());

  it("바디 있으면 Content-Type+Authorization+JSON 바디로 POST", async () => {
    const spy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(okJson({ ok: 1 }));
    await authedPost("/uploads/presign", "tkn", { a: 1 }, passthrough);

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tkn");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("바디 없으면 Authorization만, Content-Type·바디 없음(바디 없는 POST 보존)", async () => {
    const spy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(okJson({ ok: 1 }));
    await authedPost("/documents/d1/analyze", "tkn", undefined, passthrough);

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tkn");
    expect(headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("non-ok → HttpError(status)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(409));
    await expect(
      authedPost("/x", "t", { a: 1 }, passthrough),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

// 자동 토큰 갱신(#126) — 게이트웨이 주입 시 401 → refresh → 1회 재시도.
describe("client 401 자동 갱신", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    configureAuthGateway(null); // 다른 테스트에 누수 방지
  });

  it("401 → refreshAccess(이전 토큰)로 새 토큰 받아 1회 재시도 후 성공", async () => {
    const spy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(errStatus(401)) // 1차: 만료
      .mockResolvedValueOnce(okJson({ ok: 1 })); // 재시도: 성공
    const refreshAccess = jest.fn(async () => "fresh");
    configureAuthGateway({ refreshAccess });

    const r = await authedGet("/me/thing", "stale", passthrough);

    expect(r).toEqual({ ok: 1 });
    expect(refreshAccess).toHaveBeenCalledWith("stale");
    expect(spy).toHaveBeenCalledTimes(2);
    // 재시도는 새 토큰으로.
    const retryInit = spy.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer fresh",
    );
  });

  it("게이트웨이 미주입이면 401은 재시도 없이 HttpError(401)", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue(errStatus(401));
    await expect(authedGet("/x", "t", passthrough)).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(spy).toHaveBeenCalledTimes(1); // 재시도 없음
  });

  it("재시도도 401이면 추가 refresh 없이 HttpError(401) (루프 차단)", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue(errStatus(401));
    const refreshAccess = jest.fn(async () => "fresh");
    configureAuthGateway({ refreshAccess });

    await expect(authedGet("/x", "stale", passthrough)).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(refreshAccess).toHaveBeenCalledTimes(1); // refresh는 한 번만
    expect(spy).toHaveBeenCalledTimes(2); // 원요청 + 재시도 1회뿐
  });

  it("비401 오류는 refresh 없이 그대로 전파", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(500));
    const refreshAccess = jest.fn(async () => "fresh");
    configureAuthGateway({ refreshAccess });

    await expect(authedPost("/x", "t", { a: 1 }, passthrough)).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(refreshAccess).not.toHaveBeenCalled();
  });

  it("refreshAccess가 throw(확정 인증 실패)하면 그 에러를 전파", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(401));
    const refreshAccess = jest.fn(async () => {
      throw new Error("auth lost");
    });
    configureAuthGateway({ refreshAccess });

    await expect(authedGet("/x", "t", passthrough)).rejects.toThrow(/auth lost/);
  });
});
