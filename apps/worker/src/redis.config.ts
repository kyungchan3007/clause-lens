import IORedis, { type RedisOptions } from "ioredis";

// Redis 연결/채널 설정 — 비밀값·주소는 env로만. (api와 동일 규약, 앱은 별도라 복제.)
export function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function channelPrefix(): string {
  return process.env.REDIS_CHANNEL_PREFIX ?? "cl";
}

export function createRedis(opts?: RedisOptions): IORedis {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null, ...opts });
}
