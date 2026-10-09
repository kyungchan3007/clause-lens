import { Module } from "@nestjs/common";

import { MinioStorageAdapter } from "../../adapters/minio-storage.adapter";
import { StoragePort } from "../../ports/storage.port";
import { RetentionSweepService } from "./retention-sweep.service";

// 보관 만료 실삭제 잡(#164). 컨트롤러 없음 — standalone 스크립트(scripts/retention-sweep.ts)가 서비스를 resolve.
// PrismaService는 전역 DbModule 제공. S3 삭제는 API StoragePort(worker엔 delete 없음).
@Module({
  providers: [
    RetentionSweepService,
    { provide: StoragePort, useClass: MinioStorageAdapter },
  ],
  exports: [RetentionSweepService],
})
export class RetentionModule {}
