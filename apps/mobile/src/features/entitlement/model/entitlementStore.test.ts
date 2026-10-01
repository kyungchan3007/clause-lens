import type { EntitlementResponse } from "@clause-lens/contracts";

import { useEntitlementStore } from "./entitlementStore";
import { fetchEntitlement } from "../api/entitlementApi";
import { getAccessToken } from "../../auth";

jest.mock("../api/entitlementApi");
jest.mock("../../auth", () => ({ getAccessToken: jest.fn() }));

const fetchMock = fetchEntitlement as jest.MockedFunction<typeof fetchEntitlement>;
const tokenMock = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

const ent = (remaining: number): EntitlementResponse => ({
  freeGranted: 3,
  freeConsumed: 3 - remaining,
  freeReserved: 0,
  freeRemaining: remaining,
});

const flush = () => new Promise<void>((r) => setImmediate(r));
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const store = () => useEntitlementStore.getState();

beforeEach(() => {
  useEntitlementStore.setState({
    status: "idle",
    data: null,
    staleError: false,
    generation: 0,
    userId: null,
    inFlight: false,
    pending: false,
  });
  tokenMock.mockReset();
  tokenMock.mockResolvedValue("tkn");
  fetchMock.mockReset();
});

describe("entitlementStore.refresh", () => {
  it("정상 조회 → ready + 서버 값", async () => {
    fetchMock.mockResolvedValue(ent(2));
    await store().refresh();
    expect(store().status).toBe("ready");
    expect(store().data?.freeRemaining).toBe(2);
  });

  it("토큰 없으면 idle(조회 안 함)", async () => {
    tokenMock.mockResolvedValue(null);
    await store().refresh();
    expect(store().status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("최초 실패 → error, data는 0으로 대체하지 않음(null 유지)", async () => {
    fetchMock.mockRejectedValue(new Error("net"));
    await store().refresh();
    expect(store().status).toBe("error");
    expect(store().data).toBeNull();
  });

  it("재조회 실패 → 기존 값 유지 + staleError", async () => {
    fetchMock.mockResolvedValueOnce(ent(2));
    await store().refresh();
    fetchMock.mockRejectedValueOnce(new Error("net"));
    await store().refresh();
    expect(store().data?.freeRemaining).toBe(2); // 기존 값 유지
    expect(store().staleError).toBe(true);
    expect(store().status).toBe("ready");
  });

  it("조회 중 계정 변경 → 늦게 온 응답 폐기(이전 사용자 값 미노출)", async () => {
    const d = deferred<EntitlementResponse>();
    fetchMock.mockReturnValue(d.promise);
    const p = store().refresh(); // await 안 함
    await flush(); // getAccessToken 통과·inFlight 설정
    store().syncAccount("other"); // 세대++·초기화
    d.resolve(ent(2)); // 이전 계정 응답 도착
    await p;
    expect(store().data).toBeNull(); // 폐기됨
  });

  it("겹친 refresh → 완료 후 1회 더(갱신 요구 누락 없음)", async () => {
    const d1 = deferred<EntitlementResponse>();
    fetchMock.mockReturnValueOnce(d1.promise).mockResolvedValueOnce(ent(1));
    const p1 = store().refresh();
    await flush(); // 첫 요청 inFlight
    await store().refresh(); // 겹침 → pending만
    expect(fetchMock).toHaveBeenCalledTimes(1);
    d1.resolve(ent(2));
    await p1;
    await flush(); // finally가 두 번째 조회 수행
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store().data?.freeRemaining).toBe(1);
  });

  it("로그아웃(syncAccount null) → 잔량 제거", async () => {
    fetchMock.mockResolvedValue(ent(2));
    store().syncAccount("u1");
    await store().refresh();
    expect(store().data?.freeRemaining).toBe(2);
    store().syncAccount(null);
    expect(store().data).toBeNull();
    expect(store().status).toBe("idle");
  });

  it("같은 userId 재동기화(토큰 갱신) → 기존 값 유지", async () => {
    fetchMock.mockResolvedValue(ent(2));
    store().syncAccount("u1");
    await store().refresh();
    const gen = store().generation;
    store().syncAccount("u1"); // 같은 사용자
    expect(store().generation).toBe(gen); // 세대 안 바뀜
    expect(store().data?.freeRemaining).toBe(2); // 유지
  });
});
