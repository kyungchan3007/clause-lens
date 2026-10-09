import { documentVisible, canTransitionToSaved } from "@clause-lens/db/analysis";

// 보관 가시성·저장 선검증 순수 함수(#163). 상세(410)·목록·저장이 공유.
const NOW = new Date("2026-10-09T00:00:00.000Z");
const FUTURE = new Date("2026-10-15T00:00:00.000Z");
const PAST = new Date("2026-10-01T00:00:00.000Z");

describe("documentVisible (#163)", () => {
  it("SAVED는 retainUntil이 지났어도 노출", () => {
    expect(documentVisible({ retentionState: "SAVED", retainUntil: PAST }, NOW)).toBe(true);
  });

  it("SAVED는 retainUntil이 null이어도 노출", () => {
    expect(documentVisible({ retentionState: "SAVED", retainUntil: null }, NOW)).toBe(true);
  });

  it("TEMPORARY는 retainUntil>now면 노출", () => {
    expect(documentVisible({ retentionState: "TEMPORARY", retainUntil: FUTURE }, NOW)).toBe(true);
  });

  it("TEMPORARY는 retainUntil이 지났으면 차단", () => {
    expect(documentVisible({ retentionState: "TEMPORARY", retainUntil: PAST }, NOW)).toBe(false);
  });

  it("TEMPORARY·retainUntil null(진행중)은 통과(기존 isRetentionActive 의미)", () => {
    expect(documentVisible({ retentionState: "TEMPORARY", retainUntil: null }, NOW)).toBe(true);
  });

  it("경계: 정확히 retainUntil==now면 TEMPORARY 차단(strict >)", () => {
    expect(documentVisible({ retentionState: "TEMPORARY", retainUntil: NOW }, NOW)).toBe(false);
  });

  it("알 수 없는 상태(미래 DELETING 등)는 default-deny", () => {
    expect(documentVisible({ retentionState: "DELETING", retainUntil: FUTURE }, NOW)).toBe(false);
    expect(documentVisible({ retentionState: "", retainUntil: FUTURE }, NOW)).toBe(false);
  });
});

describe("canTransitionToSaved (#163)", () => {
  it("done·TEMPORARY·미만료면 저장 가능", () => {
    expect(
      canTransitionToSaved({ status: "done", retentionState: "TEMPORARY", retainUntil: FUTURE }, NOW),
    ).toBe(true);
  });

  it("partial도 저장 가능", () => {
    expect(
      canTransitionToSaved({ status: "partial", retentionState: "TEMPORARY", retainUntil: FUTURE }, NOW),
    ).toBe(true);
  });

  it("미완료(analyzing)는 거부", () => {
    expect(
      canTransitionToSaved({ status: "analyzing", retentionState: "TEMPORARY", retainUntil: FUTURE }, NOW),
    ).toBe(false);
  });

  it("이미 SAVED는 거부(멱등 분기는 호출측)", () => {
    expect(
      canTransitionToSaved({ status: "done", retentionState: "SAVED", retainUntil: FUTURE }, NOW),
    ).toBe(false);
  });

  it("만료(retainUntil 지남)는 거부 — 만료 후 신규 저장 불가", () => {
    expect(
      canTransitionToSaved({ status: "done", retentionState: "TEMPORARY", retainUntil: PAST }, NOW),
    ).toBe(false);
  });

  it("retainUntil null(진행중)은 방어적 거부", () => {
    expect(
      canTransitionToSaved({ status: "done", retentionState: "TEMPORARY", retainUntil: null }, NOW),
    ).toBe(false);
  });

  it("경계: 정확히 retainUntil==now면 거부(strict >)", () => {
    expect(
      canTransitionToSaved({ status: "done", retentionState: "TEMPORARY", retainUntil: NOW }, NOW),
    ).toBe(false);
  });
});
