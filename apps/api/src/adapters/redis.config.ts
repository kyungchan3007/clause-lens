import IORedis, { type RedisOptions } from "ioredis";

// Redis 연결 설정 — 비밀값·주소는 env로만. BullMQ는 maxRetriesPerRequest: null 필요.
export function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

// 공유 Redis 대비 채널 prefix 격리(Pub/Sub는 DB 번호로 격리되지 않음).
export function channelPrefix(): string {
  return process.env.REDIS_CHANNEL_PREFIX ?? "cl";
}

export function createRedis(opts?: RedisOptions): IORedis {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null, ...opts });
}
