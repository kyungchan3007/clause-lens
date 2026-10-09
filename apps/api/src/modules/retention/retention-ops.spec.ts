import {
  deletionReason,
  isTemporaryHardDeletable,
  RETENTION_DELETE_LAG_DAYS,
} from "@clause-lens/db/analysis";

// 무료 만료 실삭제 후보 판정(#164) — 안전 지연(LAG) 포함.
const NOW = new Date("2026-10-09T00:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const ago = (d: number) => new Date(NOW.getTime() - d * day);
const ahead = (d: number) => new Date(NOW.getTime() + d * day);

describe("isTemporaryHardDeletable (#164)", () => {
  it("TEMPORARY·retainUntil이 LAG일보다 더 지났으면 대상", () => {
    expect(isTemporaryHardDeletable({ retentionState: "TEMPORARY", retainUntil: ago(RETENTION_DELETE_LAG_DAYS + 1) }, NOW)).toBe(true);
  });

  it("경계: retainUntil + LAG == now면 대상(<=)", () => {
    expect(isTemporaryHardDeletable({ retentionState: "TEMPORARY", retainUntil: ago(RETENTION_DELETE_LAG_DAYS) }, NOW)).toBe(true);
  });

  it("만료됐지만 LAG 유예 중이면 비대상", () => {
    expect(isTemporaryHardDeletable({ retentionState: "TEMPORARY", retainUntil: ago(1) }, NOW)).toBe(false);
  });

  it("retainUntil 미래면 비대상", () => {
    expect(isTemporaryHardDeletable({ retentionState: "TEMPORARY", retainUntil: ahead(1) }, NOW)).toBe(false);
  });

  it("retainUntil null(진행중·draft/failed)이면 비대상", () => {
    expect(isTemporaryHardDeletable({ retentionState: "TEMPORARY", retainUntil: null }, NOW)).toBe(false);
  });

  it("SAVED는 비대상(#164 범위 밖 — SAVED 삭제는 #165)", () => {
    expect(isTemporaryHardDeletable({ retentionState: "SAVED", retainUntil: ago(100) }, NOW)).toBe(false);
  });

  it("DELETING(이미 진행)도 TEMPORARY 아니라 비대상(재선정 방지)", () => {
    expect(isTemporaryHardDeletable({ retentionState: "DELETING", retainUntil: ago(100) }, NOW)).toBe(false);
  });
});

describe("deletionReason (#164)", () => {
  it("대상이면 free_expired", () => {
    expect(deletionReason({ retentionState: "TEMPORARY", retainUntil: ago(RETENTION_DELETE_LAG_DAYS + 1) }, NOW)).toBe("free_expired");
  });
  it("비대상이면 null", () => {
    expect(deletionReason({ retentionState: "SAVED", retainUntil: ago(100) }, NOW)).toBeNull();
  });
});
