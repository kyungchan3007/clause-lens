import { S3Client } from "@aws-sdk/client-s3";

// S3 호환 클라이언트 생성 — 로컬=MinIO, 프로덕션=Railway Bucket(둘 다 S3 API).
// 주소방식(path/virtual-hosted)·endpoint·region·키는 env로 분리.
// api(NestJS ConfigService)·worker(process.env)의 env 읽기 방식 차이를 EnvReader로 흡수.
// (이전: minio-storage.adapter.ts · s3-storage.adapter.ts의 S3Client 생성 블록 복제본)

/** env 접근 추상화 — infra가 @nestjs/config에 의존하지 않도록 getter만 요구. */
export interface EnvReader {
  /** 필수 값 — 없으면 throw. */
  required(key: string): string;
  /** 선택 값 — 없으면 undefined. */
  optional(key: string): string | undefined;
}

/** S3Client 생성에 필요한 파싱된 설정(버킷·오퍼레이션은 각 어댑터 책임이라 제외). */
export interface S3Config {
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
}

/** process.env 기반 기본 EnvReader (worker용). */
export const processEnvReader: EnvReader = {
  required(key: string): string {
    const v = process.env[key];
    if (!v) throw new Error(`missing env: ${key}`);
    return v;
  },
  optional(key: string): string | undefined {
    return process.env[key];
  },
};

// env → S3Config. 기본값(region=us-east-1, forcePathStyle 파싱)은 두 어댑터 공통 규약 보존.
export function parseS3Config(env: EnvReader): S3Config {
  return {
    endpoint: env.required("S3_ENDPOINT"),
    region: env.optional("S3_REGION") ?? "us-east-1",
    forcePathStyle: (env.optional("S3_FORCE_PATH_STYLE") ?? "true") !== "false",
    accessKeyId: env.required("S3_ACCESS_KEY"),
    secretAccessKey: env.required("S3_SECRET_KEY"),
  };
}

export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/** env → S3Client 한 번에. api·worker가 가장 흔히 쓰는 경로. */
export function createS3ClientFromEnv(env: EnvReader): S3Client {
  return createS3Client(parseS3Config(env));
}
