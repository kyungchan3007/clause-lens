import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DbModule } from "./db/db.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { HealthModule } from "./modules/health/health.module";
import { UploadsModule } from "./modules/uploads/uploads.module";

@Module({
  imports: [
    // .env 로딩(전역). 비밀값은 코드가 아니라 env로만.
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    HealthModule,
    AuthModule,
    DocumentsModule,
    UploadsModule,
  ],
})
export class AppModule {}
