import { Injectable } from "@nestjs/common";
import type { EntitlementResponse } from "@clause-lens/contracts";
import { getEntitlement } from "@clause-lens/db/analysis";

import { PrismaService } from "../../db/prisma.service";

// 자격(무료 분석 횟수) 조회 — 서버 값만 반환. 실차감·예약은 분석 파이프라인(#90)에서.
@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  // 현재 잔량 조회(없으면 기본 부여 후). 앱은 이 값을 표시만 한다.
  getMine(userId: string): Promise<EntitlementResponse> {
    return getEntitlement(this.prisma, userId);
  }
}
