import { Injectable } from "@nestjs/common";
import {
  GetObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { createS3ClientFromEnv, processEnvReader } from "@clause-lens/infra";

import { ValidationError } from "../lib/errors";
import { StoragePort, type GetObjectOpts } from "../ports/storage.port";

// S3 호환 읽기 어댑터. 로컬=MinIO, 프로덕션=Railway Bucket(둘 다 S3 API). 주소·키는 env로만.
@Injectable()
export class S3StorageAdapter extends StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    super();
    this.bucket = reqEnv("S3_BUCKET");
    // 생성 블록은 @clause-lens/infra로 통합(process.env 기반 EnvReader).
    this.client = createS3ClientFromEnv(processEnvReader);
  }

  async getObject(key: string, opts: GetObjectOpts): Promise<Uint8Array> {
    // 다운로드 전 HEAD로 크기 선확인(초과면 즉시 거부 — 바이트 폭증 방어).
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if ((head.ContentLength ?? 0) > opts.maxBytes) {
      throw new ValidationError("invalid_image");
    }
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = out.Body
      ? await out.Body.transformToByteArray()
      : new Uint8Array();
    if (bytes.byteLength > opts.maxBytes) {
      throw new ValidationError("invalid_image");
    }
    return bytes;
  }
}

function reqEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing env: ${k}`);
  return v;
}
