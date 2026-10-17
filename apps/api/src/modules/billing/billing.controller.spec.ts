import type { BillingIdentifyService } from "./billing-identify.service";
import { BillingController } from "./billing.controller";

describe("BillingController", () => {
  it("identify → 서비스에 인증 사용자 userId 전달", async () => {
    const calls: string[] = [];
    const service = {
      identify: async (userId: string) => {
        calls.push(userId);
        return { customerId: userId, mappingCreated: true, synced: { outcome: "noop" as const, applied: 0 } };
      },
    };
    const controller = new BillingController(service as unknown as BillingIdentifyService);
    const r = await controller.identify({ userId: "u1", provider: "KAKAO" });
    expect(calls).toEqual(["u1"]);
    expect(r.customerId).toBe("u1");
  });
});
