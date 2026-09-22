// 스토리지 외부 경계(포트). 구현은 adapters/minio-storage.adapter (로컬 MinIO / 프로덕션 Railway Bucket).
// Service는 이 포트에만 의존 → 인프라 교체 시 어댑터만 교체.

export interface PresignPutParams {
  key: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface HeadResult {
  exists: boolean;
  size: number;
  etag?: string;
  contentType?: string;
}

export interface CopyParams {
  fromKey: string;
  toKey: string;
  ifMatchETag?: string; // 검증한 객체가 그대로일 때만 copy(경쟁 방지)
}

// DI 토큰 겸 인터페이스(NestJS는 abstract class를 provide 토큰으로 사용).
export abstract class StoragePort {
  abstract presignPut(params: PresignPutParams): Promise<string>;
  abstract head(key: string): Promise<HeadResult>;
  abstract copy(params: CopyParams): Promise<void>;
  abstract getHeadBytes(key: string, length: number): Promise<Uint8Array>;
  abstract delete(key: string): Promise<void>;
}
