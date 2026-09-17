import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

// 전역 모듈 — 어느 도메인 모듈에서든 PrismaService 주입 가능.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DbModule {}
