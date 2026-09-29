// 저장소 읽기 경계(포트). 구현 = adapters/s3-storage.adapter (로컬 MinIO / 프로덕션 Railway Bucket).
// worker는 원본 이미지 바이트만 필요(읽기 전용). 쓰기·presign은 api.

export interface GetObjectOpts {
  maxBytes: number; // 초과 시 다운로드 중단(메모리 폭증·거대 이미지 방어, 0021 §⑥)
}

export abstract class StoragePort {
  abstract getObject(key: string, opts: GetObjectOpts): Promise<Uint8Array>;
}
