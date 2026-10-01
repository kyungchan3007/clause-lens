import { HttpError, authedGet, authedPost, baseUrl } from "./client";

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
