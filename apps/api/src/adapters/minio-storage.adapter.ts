import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  type CopyParams,
  type HeadResult,
  type PresignPutParams,
  StoragePort,
} from "../ports/storage.port";

// S3 호환 어댑터. 로컬=MinIO, 프로덕션=Railway Bucket(둘 다 S3 API).
// 주소방식(path/virtual-hosted)·endpoint·region·키는 env로 분리.
@Injectable()
export class MinioStorageAdapter extends StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    super();
    this.bucket = config.getOrThrow<string>("S3_BUCKET");
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>("S3_ENDPOINT"),
      region: config.get<string>("S3_REGION") ?? "us-east-1",
      forcePathStyle:
        (config.get<string>("S3_FORCE_PATH_STYLE") ?? "true") !== "false",
      credentials: {
        accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow<string>("S3_SECRET_KEY"),
      },
    });
  }

  async presignPut(params: PresignPutParams): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    return getSignedUrl(this.client, cmd, {
      expiresIn: params.expiresInSeconds,
      // ContentType을 서명에 고정(헤더 변조 방지). 앱은 같은 Content-Type으로 PUT해야 함.
      signableHeaders: new Set(["content-type"]),
    });
  }

  async head(key: string): Promise<HeadResult> {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        exists: true,
        size: out.ContentLength ?? 0,
        etag: out.ETag,
        contentType: out.ContentType,
      };
    } catch (e) {
      if (isNotFound(e)) return { exists: false, size: 0 };
      throw e;
    }
  }

  async copy(params: CopyParams): Promise<void> {
    const out = await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: params.toKey,
        // 세그먼트별 인코딩(슬래시는 보존) — encodeURI는 #·?·+ 등을 안전 처리 못 함.
        CopySource: `${this.bucket}/${encodeS3Key(params.fromKey)}`,
        ...(params.ifMatchETag
          ? { CopySourceIfMatch: params.ifMatchETag }
          : {}),
      }),
    );
    // CopyObject는 200 응답 본문에 에러를 담을 수 있음 → 결과 본문 확인.
    if (!out.CopyObjectResult?.ETag) {
      throw new Error("copy failed: empty CopyObjectResult");
    }
  }

  async getHeadBytes(key: string, length: number): Promise<Uint8Array> {
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=0-${length - 1}`,
      }),
    );
    return out.Body
      ? await out.Body.transformToByteArray()
      : new Uint8Array();
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

// S3 CopySource용 키 인코딩: 각 경로 세그먼트를 encodeURIComponent, 슬래시는 보존.
function encodeS3Key(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function isNotFound(e: unknown): boolean {
  const name = (e as { name?: string })?.name;
  const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}
