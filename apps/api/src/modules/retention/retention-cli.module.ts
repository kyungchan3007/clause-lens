import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DbModule } from "../../db/db.module";
import { RetentionModule } from "./retention.module";

// 실삭제 잡(#164) 전용 CLI 부트스트랩 모듈.
// AppModule(앱 서버)에는 RetentionModule을 포함하지 않는다 → 런타임·엔드포인트·스케줄러에서
// RetentionSweepService가 주입·호출될 수 없음(standalone-only, 적대적 리뷰 C6). 스크립트만 이 모듈을 부트스트랩.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, RetentionModule],
})
export class RetentionCliModule {}
