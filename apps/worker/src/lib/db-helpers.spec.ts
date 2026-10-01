import {
  JOB_TERMINAL_STATUSES,
  PAGE_TERMINAL_STATUSES,
  isJobTerminal,
  isPageTerminal,
  isSerializationFailure,
  isUniqueViolation,
} from "@clause-lens/db/analysis";

// packages/db 단일 소스 헬퍼의 값·판정 불변 검증(#141).
// 종결 집합 값·에러 코드(P2002·P2034)가 인라인 판정과 완전 동일해야 한다.
describe("db domain helpers (single source, #141)", () => {
  describe("terminal status sets", () => {
    it("job terminal = done·partial·failed (값 고정)", () => {
      expect([...JOB_TERMINAL_STATUSES]).toEqual(["done", "partial", "failed"]);
    });

    it("page terminal = done·failed (값 고정)", () => {
      expect([...PAGE_TERMINAL_STATUSES]).toEqual(["done", "failed"]);
    });

    it("isJobTerminal: 종결 상태만 true", () => {
      expect(isJobTerminal("done")).toBe(true);
      expect(isJobTerminal("partial")).toBe(true);
      expect(isJobTerminal("failed")).toBe(true);
      expect(isJobTerminal("queued")).toBe(false);
      expect(isJobTerminal("processing")).toBe(false);
      expect(isJobTerminal("")).toBe(false);
    });

    it("isPageTerminal: done·failed만 true (partial은 페이지 종결 아님)", () => {
      expect(isPageTerminal("done")).toBe(true);
      expect(isPageTerminal("failed")).toBe(true);
      expect(isPageTerminal("partial")).toBe(false);
      expect(isPageTerminal("pending")).toBe(false);
      expect(isPageTerminal("")).toBe(false);
    });
  });

  describe("Prisma error discriminators", () => {
    it("isUniqueViolation: P2002만 true", () => {
      expect(isUniqueViolation({ code: "P2002" })).toBe(true);
      expect(isUniqueViolation({ code: "P2034" })).toBe(false);
      expect(isUniqueViolation({ code: "P2025" })).toBe(false);
      expect(isUniqueViolation(new Error("boom"))).toBe(false);
      expect(isUniqueViolation(null)).toBe(false);
      expect(isUniqueViolation(undefined)).toBe(false);
    });

    it("isSerializationFailure: P2034만 true", () => {
      expect(isSerializationFailure({ code: "P2034" })).toBe(true);
      expect(isSerializationFailure({ code: "P2002" })).toBe(false);
      expect(isSerializationFailure(new Error("boom"))).toBe(false);
      expect(isSerializationFailure(null)).toBe(false);
      expect(isSerializationFailure(undefined)).toBe(false);
    });
  });
});
