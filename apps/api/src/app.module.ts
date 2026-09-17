import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DbModule } from "./db/db.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    // .env 로딩(전역). 비밀값은 코드가 아니라 env로만.
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    HealthModule,
  ],
})
export class AppModule {}
