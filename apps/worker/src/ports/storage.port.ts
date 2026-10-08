// 저장소 경계(포트). 구현 = adapters/s3-storage.adapter (로컬 MinIO / 프로덕션 Railway Bucket).
// worker는 원본 바이트 읽기 + 정규화(upright) 결과 이미지 쓰기(#175). presign은 api.

export interface GetObjectOpts {
  maxBytes: number; // 초과 시 다운로드 중단(메모리 폭증·거대 이미지 방어, 0021 §⑥)
}

export abstract class StoragePort {
  abstract getObject(key: string, opts: GetObjectOpts): Promise<Uint8Array>;
  // 정규화 이미지 영속(#175). best-effort — 실패해도 분석은 진행(호출측이 처리).
  abstract putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}
