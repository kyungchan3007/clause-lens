// 데코레이터 메타데이터 로더 — 엔트리 최상단에서 먼저 로드(방어적, 번들러 tree-shaking 대비).
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // rawBody: 웹훅 HMAC 검증을 원본 바이트(req.rawBody)로 하기 위해 보존(#165 Slice 2).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
