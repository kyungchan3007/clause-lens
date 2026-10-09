// db 도메인 함수는 실 Postgres raw SQL이라 모킹 — 서비스 오케스트레이션(순서·중단·실패 처리)만 검증.
jest.mock("@clause-lens/db/analysis", () => ({
  countHardDeleteCandidates: jest.fn(),
  findHardDeleteCandidates: jest.fn(),
  transitionToDeleting: jest.fn(),
  loadDocumentKeysData: jest.fn(),
  recordDeletionAudit: jest.fn(),
  deleteDocumentRow: jest.fn(),
}));

import {
  countHardDeleteCandidates,
  deleteDocumentRow,
  findHardDeleteCandidates,
  loadDocumentKeysData,
  recordDeletionAudit,
  transitionToDeleting,
} from "@clause-lens/db/analysis";

import { RetentionSweepService } from "./retention-sweep.service";
import type { PrismaService } from "../../db/prisma.service";
import type { StoragePort } from "../../ports/storage.port";

const mCount = countHardDeleteCandidates as jest.Mock;
const mFind = findHardDeleteCandidates as jest.Mock;
const mFlip = transitionToDeleting as jest.Mock;
const mKeys = loadDocumentKeysData as jest.Mock;
const mAudit = recordDeletionAudit as jest.Mock;
const mDelRow = deleteDocumentRow as jest.Mock;

function makeSvc(storage: Partial<StoragePort>) {
  return new RetentionSweepService({} as PrismaService, storage as StoragePort);
}
const keysData = (over = {}) => ({
  userId: "u1",
  pages: [{ pageId: "pg1", finalKey: "documents/d1/pages/pg1/r1/abc", revision: 1 }],
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("RetentionSweepService.dryRun (#164)", () => {
  it("쓰기 없이 후보·키 계획만 반환", async () => {
    mCount.mockResolvedValue(2);
    mFind.mockResolvedValue([{ documentId: "d1", userId: "u1" }]);
    mKeys.mockResolvedValue(keysData());
    const svc = makeSvc({ delete: jest.fn() });

    const r = await svc.dryRun(10);
    expect(r.totalCandidates).toBe(2);
    expect(r.batch).toBe(1);
    expect(r.plans[0].keys).toContain("documents/d1/pages/pg1/r1/abc");
    // 쓰기 경로 미호출
    expect(mFlip).not.toHaveBeenCalled();
    expect(mDelRow).not.toHaveBeenCalled();
    expect(mAudit).not.toHaveBeenCalled();
  });
});

describe("RetentionSweepService.execute (#164)", () => {
  it("정상: CAS→키열거→감사→S3삭제→행삭제, 감사는 행삭제보다 먼저", async () => {
    mCount.mockResolvedValue(1);
    mFind.mockResolvedValue([{ documentId: "d1", userId: "u1" }]);
    mFlip.mockResolvedValue(true);
    mKeys.mockResolvedValue(keysData());
    const del = jest.fn().mockResolvedValue(undefined);
    const svc = makeSvc({ delete: del });

    const r = await svc.execute(10, 500);
    expect(r.deleted).toBe(1);
    expect(r.failed).toBe(0);
    expect(del).toHaveBeenCalled();
    expect(mDelRow).toHaveBeenCalledWith(expect.anything(), "d1");
    // 감사 기록이 행 삭제보다 먼저
    expect(mAudit.mock.invocationCallOrder[0]).toBeLessThan(mDelRow.mock.invocationCallOrder[0]);
  });

  it("후보 수가 상한 초과 → run 전체 중단(삭제 0·후보 미조회)", async () => {
    mCount.mockResolvedValue(600);
    const svc = makeSvc({ delete: jest.fn() });
    const r = await svc.execute(10, 500);
    expect(r.aborted?.reason).toBe("candidate_count_over_cap");
    expect(r.deleted).toBe(0);
    expect(mFind).not.toHaveBeenCalled();
  });

  it("CAS 0행(사이 변경) → skip, 키열거·행삭제 안 함", async () => {
    mCount.mockResolvedValue(1);
    mFind.mockResolvedValue([{ documentId: "d1", userId: "u1" }]);
    mFlip.mockResolvedValue(false);
    const svc = makeSvc({ delete: jest.fn() });
    const r = await svc.execute(10, 500);
    expect(r.skipped).toBe(1);
    expect(r.deleted).toBe(0);
    expect(mKeys).not.toHaveBeenCalled();
    expect(mDelRow).not.toHaveBeenCalled();
  });

  it("S3 삭제 실패(transient) → 행 삭제 보류(DELETING 잔류), 감사는 남음", async () => {
    mCount.mockResolvedValue(1);
    mFind.mockResolvedValue([{ documentId: "d1", userId: "u1" }]);
    mFlip.mockResolvedValue(true);
    mKeys.mockResolvedValue(keysData());
    const del = jest.fn().mockRejectedValue(new Error("timeout"));
    const svc = makeSvc({ delete: del });

    const r = await svc.execute(10, 500);
    expect(r.failed).toBe(1);
    expect(r.deleted).toBe(0);
    expect(mAudit).toHaveBeenCalledTimes(1); // 삭제 전 기록은 남음
    expect(mDelRow).not.toHaveBeenCalled(); // 행 삭제 안 함
  });

  it("S3 삭제가 NotFound를 throw해도 멱등 성공 → 행 삭제됨(설계 계약)", async () => {
    mCount.mockResolvedValue(1);
    mFind.mockResolvedValue([{ documentId: "d1", userId: "u1" }]);
    mFlip.mockResolvedValue(true);
    mKeys.mockResolvedValue(keysData());
    const del = jest.fn().mockRejectedValue(Object.assign(new Error("not found"), { name: "NotFound" }));
    const svc = makeSvc({ delete: del });

    const r = await svc.execute(10, 500);
    expect(r.deleted).toBe(1); // NotFound는 성공 취급
    expect(r.failed).toBe(0);
    expect(mDelRow).toHaveBeenCalledWith(expect.anything(), "d1");
  });

  it("kill-switch(RETENTION_SWEEP_DISABLED) → execute 즉시 거부(후보 미조회·삭제 0)", async () => {
    const prev = process.env.RETENTION_SWEEP_DISABLED;
    process.env.RETENTION_SWEEP_DISABLED = "1";
    try {
      const svc = makeSvc({ delete: jest.fn() });
      const r = await svc.execute(10, 500);
      expect(r.aborted?.reason).toBe("kill_switch_disabled");
      expect(r.deleted).toBe(0);
      expect(mCount).not.toHaveBeenCalled();
      expect(mFind).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.RETENTION_SWEEP_DISABLED;
      else process.env.RETENTION_SWEEP_DISABLED = prev;
    }
  });
});

describe("isNotFoundError (#164)", () => {
  it("name/Code/HTTP 404 계열은 true, 그 외는 false", () => {
    const { isNotFoundError } = require("./retention-sweep.service");
    expect(isNotFoundError({ name: "NotFound" })).toBe(true);
    expect(isNotFoundError({ name: "NoSuchKey" })).toBe(true);
    expect(isNotFoundError({ Code: "NoSuchKey" })).toBe(true);
    expect(isNotFoundError({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    // 래퍼/라이브러리 최상위 statusCode/status(숫자·문자열 404)
    expect(isNotFoundError({ statusCode: 404 })).toBe(true);
    expect(isNotFoundError({ status: 404 })).toBe(true);
    expect(isNotFoundError({ statusCode: "404" })).toBe(true);
    expect(isNotFoundError({ status: "404" })).toBe(true);
    expect(isNotFoundError(new Error("timeout"))).toBe(false);
    expect(isNotFoundError({ $metadata: { httpStatusCode: 500 } })).toBe(false);
    expect(isNotFoundError({ statusCode: 500 })).toBe(false);
  });
});
