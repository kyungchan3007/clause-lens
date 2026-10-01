import { completedAtLabel, retentionBadge, riskSummary } from "./retentionBadge";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-08T12:00:00.000Z");

describe("retentionBadge", () => {
  it("완료 직후(7일) → '7일 후 삭제'(비긴급)", () => {
    const r = retentionBadge(new Date(now.getTime() + 7 * DAY).toISOString(), now);
    expect(r).toEqual({ label: "7일 후 삭제", urgent: false });
  });

  it("약 1.5일 남음 → '1일 후 삭제'(floor)", () => {
    const r = retentionBadge(new Date(now.getTime() + 1.5 * DAY).toISOString(), now);
    expect(r).toEqual({ label: "1일 후 삭제", urgent: false });
  });

  it("하루 미만 → '오늘 만료'(긴급)", () => {
    const r = retentionBadge(new Date(now.getTime() + 5 * 3600_000).toISOString(), now);
    expect(r).toEqual({ label: "오늘 만료", urgent: true });
  });

  it("이미 지남 → '오늘 만료'(방어)", () => {
    const r = retentionBadge(new Date(now.getTime() - 1000).toISOString(), now);
    expect(r.urgent).toBe(true);
  });
});

describe("completedAtLabel", () => {
  it("오늘 → '오늘 HH:MM'", () => {
    const d = new Date("2026-10-08T09:05:00.000Z");
    // 로컬 시간대에 의존하지 않도록 접두사만 확인.
    expect(completedAtLabel(d.toISOString(), now).startsWith("오늘 ")).toBe(true);
  });

  it("어제 → '어제'", () => {
    expect(completedAtLabel(new Date("2026-10-07T10:00:00.000Z").toISOString(), now)).toBe(
      "어제",
    );
  });

  it("그 이전 → 'M/D'", () => {
    expect(completedAtLabel(new Date("2026-09-28T10:00:00.000Z").toISOString(), now)).toBe(
      "9/28",
    );
  });
});

describe("riskSummary", () => {
  it("합계 + 최고 severity(high>medium>low)", () => {
    expect(riskSummary({ high: 2, medium: 1, low: 3 })).toEqual({ total: 6, top: "high" });
    expect(riskSummary({ high: 0, medium: 1, low: 3 })).toEqual({ total: 4, top: "medium" });
    expect(riskSummary({ high: 0, medium: 0, low: 2 })).toEqual({ total: 2, top: "low" });
  });

  it("조항 없음 → top=null", () => {
    expect(riskSummary({ high: 0, medium: 0, low: 0 })).toEqual({ total: 0, top: null });
  });
});
