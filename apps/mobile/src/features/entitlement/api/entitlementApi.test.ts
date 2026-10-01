import { fetchEntitlement } from "./entitlementApi";
import { HttpError } from "../../../shared/http";

// EXPO_PUBLIC_API_BASE_URL은 jest.setup.js에서 http://localhost:3000으로 설정됨.
const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
const errStatus = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as Response;

const ent = { freeGranted: 3, freeConsumed: 1, freeReserved: 0, freeRemaining: 2 };

describe("entitlementApi.fetchEntitlement", () => {
  afterEach(() => jest.restoreAllMocks());

  it("정상: 파싱 + Authorization 헤더", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue(okJson(ent));
    const r = await fetchEntitlement("tkn");
    expect(r.freeRemaining).toBe(2);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tkn",
    );
  });

  it("HTTP 오류 → HttpError(status)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(401));
    await expect(fetchEntitlement("t")).rejects.toBeInstanceOf(HttpError);
    await fetchEntitlement("t").catch((e) =>
      expect((e as HttpError).status).toBe(401),
    );
  });

  it("스키마 불일치 → 거부(zod)", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(okJson({ freeRemaining: "two" }));
    await expect(fetchEntitlement("t")).rejects.toBeTruthy();
  });
});
