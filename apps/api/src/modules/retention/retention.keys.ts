import { normalizedImageKey } from "@clause-lens/contracts";
import type { DocumentKeysData } from "@clause-lens/db/analysis";

// 문서 실삭제 대상 S3 키 열거(순수, #164). 세 종류:
//  - 원본 finalKey: DB(Page.finalKey)에만 — 랜덤 UUID라 복구 불가(null이면 스킵).
//  - 정규화 이미지: 결정적 — contracts normalizedImageKey 헬퍼(손으로 포맷 금지).
//  - tmp 업로드 잔여: 확정 시 best-effort 삭제라 남을 수 있음. 포맷은 uploads.service.ts tmpKey와 동일(변경 시 함께).
// NOTE(TASK-007): revision>1이면 구 revision 키는 Page.finalKey가 덮어써져 열거 불가 → 알려진 후속 누수.
export function documentDeletionKeys(documentId: string, data: DocumentKeysData): string[] {
  const keys: string[] = [];
  for (const p of data.pages) {
    if (p.finalKey) keys.push(p.finalKey);
    keys.push(normalizedImageKey(documentId, p.pageId, p.revision));
    keys.push(`tmp/${data.userId}/${documentId}/${p.pageId}`);
  }
  return [...new Set(keys)]; // 중복 제거
}
