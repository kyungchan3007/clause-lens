import { Injectable } from "@nestjs/common";
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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
    this.client = new S3Client({
      endpoint: reqEnv("S3_ENDPOINT"),
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
      credentials: {
        accessKeyId: reqEnv("S3_ACCESS_KEY"),
        secretAccessKey: reqEnv("S3_SECRET_KEY"),
      },
    });
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
