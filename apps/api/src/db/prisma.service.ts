import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@clause-lens/db";

/**
 * Prisma 접근 서비스. PrismaClient를 확장한다.
 * 부팅 시 연결을 강제하지 않는다(Prisma는 첫 쿼리에 지연 연결) → DB 없이도 앱이 뜬다.
 * DB readiness 확인은 별도 엔드포인트로 후속.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
