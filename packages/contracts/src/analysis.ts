import { z } from "zod";

import { documentStatusSchema } from "./uploads";

// 분석 요청·상태 폴링 계약 — 앱↔API 단일 소스(타입 + 런타임 검증).
// 설계: agents/intent/specs/0020-analysis-request-polling.md
// 원칙: 요청·결과 분리(jobId 즉시), 응답 shape는 POST·GET·SSE 동일(transport-무관).

// ── 상태 enum (DB enum과 문자열 일치) ──
export const analysisJobStatusSchema = z.enum([
  "queued",
  "processing",
  "done",
  "partial",
  "failed",
]);

export const pageAnalysisStatusSchema = z.enum([
  "pending",
  "processing",
  "done",
  "failed",
]);

// ── 사용자용 오류 코드(원문 텍스트·PII 금지) ──
export const ANALYSIS_ERROR_CODES = [
  "not_uploaded", // 아직 업로드 확정 전
  "not_owner", // 소유자 아님
  "expired", // 세션 만료
  "ocr_timeout", // (TASK-004) OCR 시간 초과
  "ocr_failed", // (TASK-004) OCR 실패
  "invalid_image", // (TASK-004) 디코딩·픽셀 제한 위반
  "stale_revision", // 처리 중 페이지 교체 → 폐기
] as const;
export const analysisErrorCodeSchema = z.enum(ANALYSIS_ERROR_CODES);

// ── 페이지별 결과 ──
export const pageAnalysisResultSchema = z.object({
  pageId: z.string(),
  order: z.number().int().min(0),
  status: pageAnalysisStatusSchema,
  revision: z.number().int().positive(),
  errorCode: analysisErrorCodeSchema.optional(),
  retryable: z.boolean().optional(),
});

// ── 상태 응답 (POST analyze · GET status · SSE 공통 shape) ──
export const analysisStatusResponseSchema = z.object({
  jobId: z.string(),
  documentId: z.string(),
  status: documentStatusSchema, // 문서 종합 상태
  stateVersion: z.number().int().positive(), // 단조 증가(역순 도착 방지)
  job: z.object({
    status: analysisJobStatusSchema,
    totalPages: z.number().int().positive(),
  }),
  pages: z.array(pageAnalysisResultSchema),
});

// analyze 응답 = status 응답과 동일 shape (교체 가능)
export const analyzeResponseSchema = analysisStatusResponseSchema;

// ── 추론 타입 ──
export type AnalysisJobStatus = z.infer<typeof analysisJobStatusSchema>;
export type PageAnalysisStatus = z.infer<typeof pageAnalysisStatusSchema>;
export type AnalysisErrorCode = z.infer<typeof analysisErrorCodeSchema>;
export type PageAnalysisResult = z.infer<typeof pageAnalysisResultSchema>;
export type AnalysisStatusResponse = z.infer<typeof analysisStatusResponseSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
