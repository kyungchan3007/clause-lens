import { z } from "zod";

// 분석 기록 재열람 — 문서 목록 계약(앱↔API 단일 소스). 설계: specs/0030-recall-documents-list/
// 원칙: "서버가 진실의 기준" — 앱은 아래 집계·보관 기한을 표시만 하고 임의 계산하지 않는다.

// 위험 건수 기준(고정): 공개 결과(최신 terminal 성공) 조항의 riskLevel별 개수.
// 화면 "위험 N건" = high+medium+low 합. 색 점 = 존재하는 최고 severity(high>medium>low, 없으면 중립).
export const riskCountsSchema = z.object({
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
});
export type RiskCounts = z.infer<typeof riskCountsSchema>;

export const documentListItemSchema = z.object({
  documentId: z.string(),
  completedAt: z.string().datetime(), // 분석 완료(재열람 가능) 시각 ISO
  retainUntil: z.string().datetime(), // 재열람 보관 기한 ISO(이후 접근 차단). 앱은 "N일 후 삭제" 표시에 사용
  status: z.enum(["done", "partial"]), // partial = 일부 페이지만 분석 완료
  totalPageCount: z.number().int().nonnegative(),
  analyzedPageCount: z.number().int().nonnegative(), // partial 구분(일부 분석 완료)
  risk: riskCountsSchema,
  label: z.string(), // "계약서 · N장" (임시 문서명)
});
export type DocumentListItem = z.infer<typeof documentListItemSchema>;

export const documentListResponseSchema = z.object({
  items: z.array(documentListItemSchema),
  nextCursor: z.string().nullable(), // null = 마지막 페이지
});
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;

// 목록 페이지 크기(기본·상한). 서버가 상한을 강제(표시용 공유 상수).
export const DOCUMENTS_PAGE_SIZE_DEFAULT = 20;
export const DOCUMENTS_PAGE_SIZE_MAX = 50;

// 보관 기간이 지나 재열람이 차단될 때의 상태 코드(앱이 "보관 기간이 지났어요"로 분기).
export const RETENTION_EXPIRED_CODE = "retention_expired" as const;
