import { channelPrefix, createRedis, redisUrl } from "./redis";

// ioredis를 가짜로 — 실제 연결 없이 생성 인자만 검증.
jest.mock("ioredis", () => {
  const ctor = jest.fn();
  return { __esModule: true, default: ctor };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IORedis = require("ioredis").default as jest.Mock;

describe("redis config helpers", () => {
  const OLD = process.env;
  beforeEach(() => {
    jest.resetModules();
    IORedis.mockClear();
    process.env = { ...OLD };
    delete process.env.REDIS_URL;
    delete process.env.REDIS_CHANNEL_PREFIX;
  });
  afterAll(() => {
    process.env = OLD;
  });

  it("redisUrl: env 우선, 없으면 로컬 기본값", () => {
    expect(redisUrl()).toBe("redis://localhost:6379");
    process.env.REDIS_URL = "redis://example:6380";
    expect(redisUrl()).toBe("redis://example:6380");
  });

  it("channelPrefix: env 우선, 없으면 cl", () => {
    expect(channelPrefix()).toBe("cl");
    process.env.REDIS_CHANNEL_PREFIX = "x";
    expect(channelPrefix()).toBe("x");
  });

  it("createRedis: maxRetriesPerRequest=null 고정(BullMQ 필수), url 전달", () => {
    createRedis();
    expect(IORedis).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  });

  it("createRedis: 호출부 opts가 기본값을 덮어쓸 수 있음", () => {
    createRedis({ maxRetriesPerRequest: 3, lazyConnect: true });
    expect(IORedis).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  });
});
