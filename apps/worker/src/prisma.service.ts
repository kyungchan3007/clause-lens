import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@clause-lens/db";

// worker의 Prisma 접근. api와 별도 프로세스(공유는 packages/db).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
