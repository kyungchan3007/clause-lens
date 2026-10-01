import type { Prisma, PrismaClient } from "@clause-lens/db";
import {
  getEntitlement,
  reserveFreeAnalysis,
  settleFreeAnalysis,
} from "@clause-lens/db/analysis";

// 가짜 트랜잭션 클라이언트 — entitlement/entitlementCharge 델리게이트 + $executeRaw(조건부 예약).
// 실 DB의 원자성(단일 조건부 UPDATE)은 통합 범위. 여기선 예약·정산·멱등·한도의 오케스트레이션을 검증.
interface Charge {
  jobId: string;
  userId: string;
  status: "reserved" | "consumed" | "released";
  settledAt: Date | null;
}

function makeTx(granted = 3) {
  const ent = { userId: "u1", freeGranted: granted, freeConsumed: 0, freeReserved: 0 };
  const charges = new Map<string, Charge>();

  const tx = {
    entitlement: {
      upsert: async () => ent,
      findUniqueOrThrow: async () => ent,
      update: async ({ data }: { data: Record<string, { increment?: number; decrement?: number }> }) => {
        for (const [k, v] of Object.entries(data)) {
          const key = k as "freeReserved" | "freeConsumed";
          if (v.increment) ent[key] += v.increment;
          if (v.decrement) ent[key] -= v.decrement;
        }
        return ent;
      },
    },
    entitlementCharge: {
      findUnique: async ({ where }: { where: { jobId: string } }) =>
        charges.get(where.jobId) ?? null,
      create: async ({ data }: { data: Omit<Charge, "settledAt"> }) => {
        const row: Charge = { settledAt: null, ...data };
        charges.set(data.jobId, row);
        return row;
      },
      update: async ({ where, data }: { where: { jobId: string }; data: Partial<Charge> }) => {
        const row = charges.get(where.jobId)!;
        Object.assign(row, data);
        return row;
      },
    },
    // 조건부 예약: 가용 >= 1 이면 freeReserved++ 후 1행, 아니면 0행.
    $executeRaw: async () => {
      if (ent.freeGranted - ent.freeConsumed - ent.freeReserved >= 1) {
        ent.freeReserved += 1;
        return 1;
      }
      return 0;
    },
    // settle의 원자적 조건부 전이: reserved인 charge만 target으로 바꾸고 [{userId}] 반환, 아니면 [].
    // 태그드 템플릿 인자 순서: values = [target, jobId].
    $queryRaw: async (_strings: TemplateStringsArray, target: Charge["status"], jobId: string) => {
      const row = charges.get(jobId);
      if (!row || row.status !== "reserved") return [];
      row.status = target;
      row.settledAt = new Date();
      return [{ userId: row.userId }];
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, ent, charges };
}

describe("reserveFreeAnalysis", () => {
  it("가용 있으면 예약(true) + freeReserved++ + charge reserved", async () => {
    const { tx, ent, charges } = makeTx(3);
    const ok = await reserveFreeAnalysis(tx, "u1", "job1");
    expect(ok).toBe(true);
    expect(ent.freeReserved).toBe(1);
    expect(charges.get("job1")?.status).toBe("reserved");
  });

  it("가용 없으면 거부(false) + 예약·charge 없음", async () => {
    const { tx, ent, charges } = makeTx(0);
    const ok = await reserveFreeAnalysis(tx, "u1", "job1");
    expect(ok).toBe(false);
    expect(ent.freeReserved).toBe(0);
    expect(charges.has("job1")).toBe(false);
  });

  it("같은 jobId 재예약은 멱등(true) — 이중 예약 안 함", async () => {
    const { tx, ent } = makeTx(3);
    await reserveFreeAnalysis(tx, "u1", "job1");
    const again = await reserveFreeAnalysis(tx, "u1", "job1");
    expect(again).toBe(true);
    expect(ent.freeReserved).toBe(1); // 2가 아니라 1
  });

  it("한도 집행: 가용 1에서 동시 접수 2건 → 1건만 성공", async () => {
    const { tx, ent } = makeTx(1);
    const a = await reserveFreeAnalysis(tx, "u1", "jobA");
    const b = await reserveFreeAnalysis(tx, "u1", "jobB");
    expect(a).toBe(true);
    expect(b).toBe(false);
    expect(ent.freeReserved).toBe(1);
  });
});

describe("settleFreeAnalysis", () => {
  it("done → 확정 차감(consumed): freeReserved-- freeConsumed++", async () => {
    const { tx, ent, charges } = makeTx(3);
    await reserveFreeAnalysis(tx, "u1", "job1");
    await settleFreeAnalysis(tx, "job1", "done");
    expect(ent.freeReserved).toBe(0);
    expect(ent.freeConsumed).toBe(1);
    expect(charges.get("job1")?.status).toBe("consumed");
  });

  it.each(["partial", "failed"] as const)(
    "%s → 예약 해제(released): 무차감",
    async (outcome) => {
      const { tx, ent, charges } = makeTx(3);
      await reserveFreeAnalysis(tx, "u1", "job1");
      await settleFreeAnalysis(tx, "job1", outcome);
      expect(ent.freeReserved).toBe(0);
      expect(ent.freeConsumed).toBe(0);
      expect(charges.get("job1")?.status).toBe("released");
    },
  );

  it("중복 완료 이벤트는 멱등: 두 번째 done 호출 no-op(최대 1회 차감)", async () => {
    const { tx, ent } = makeTx(3);
    await reserveFreeAnalysis(tx, "u1", "job1");
    await settleFreeAnalysis(tx, "job1", "done");
    await settleFreeAnalysis(tx, "job1", "done");
    expect(ent.freeConsumed).toBe(1); // 2가 아님
    expect(ent.freeReserved).toBe(0);
  });

  it("예약 없는 job 정산은 no-op(throw 없음)", async () => {
    const { tx, ent } = makeTx(3);
    await expect(settleFreeAnalysis(tx, "ghost", "done")).resolves.toBeUndefined();
    expect(ent.freeConsumed).toBe(0);
  });
});

describe("getEntitlement", () => {
  function makePrisma(row?: { freeGranted: number; freeConsumed: number; freeReserved: number }) {
    let ent = row;
    const prisma = {
      entitlement: {
        upsert: async ({ create }: { create: { userId: string; freeGranted: number } }) => {
          ent ??= { freeGranted: create.freeGranted, freeConsumed: 0, freeReserved: 0 };
          return ent;
        },
        findUniqueOrThrow: async () => ent!,
      },
    };
    return prisma as unknown as PrismaClient;
  }

  it("신규 사용자는 기본 부여(3) 후 잔량 3 반환", async () => {
    const r = await getEntitlement(makePrisma(), "u1");
    expect(r).toEqual({ freeGranted: 3, freeConsumed: 0, freeReserved: 0, freeRemaining: 3 });
  });

  it("잔량 = granted - consumed - reserved", async () => {
    const r = await getEntitlement(makePrisma({ freeGranted: 3, freeConsumed: 1, freeReserved: 1 }), "u1");
    expect(r.freeRemaining).toBe(1);
  });

  it("잔량은 0 미만으로 내려가지 않음(하한 0)", async () => {
    const r = await getEntitlement(makePrisma({ freeGranted: 3, freeConsumed: 3, freeReserved: 1 }), "u1");
    expect(r.freeRemaining).toBe(0);
  });
});
