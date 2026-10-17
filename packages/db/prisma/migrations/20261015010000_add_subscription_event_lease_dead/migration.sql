-- #165 Slice 3: 이벤트 원자 claim lease + 저장된 dead-letter 종결 상태.
-- 값 추가만 하고 같은 트랜잭션에서 사용하지 않으므로 PG17에서 안전.
ALTER TYPE "SubscriptionEventStatus" ADD VALUE IF NOT EXISTS 'dead';

-- claim lease 토큰 겸 만료(processing 중). 완료 쓰기 조건에 사용 → 성공 역행 방지.
ALTER TABLE "SubscriptionEvent" ADD COLUMN "leaseExpiresAt" TIMESTAMPTZ(3);

-- 유실 processing 회수 선택용 인덱스.
CREATE INDEX "SubscriptionEvent_status_leaseExpiresAt_idx" ON "SubscriptionEvent" ("status", "leaseExpiresAt");
