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
  "ocr_timeout", // OCR 시간 초과(자동 재시도 소진)
  "ocr_failed", // OCR 실패(거부·디코딩·치수 불일치)
  "invalid_image", // 디코딩·픽셀/바이트 제한·MIME 위반
  "image_too_large", // 분석 입력 상한 초과(0021)
  "analysis_failed", // 위험조항 분석 영구 실패(refusal·스키마·검증실패)
  "analysis_timeout", // 분석 시간 초과(자동 재시도 소진)
  "stale_revision", // 처리 중 페이지 교체 → 폐기
  "worker_failed", // 잡 최종 실패/stall로 종결(0021 §⑤)
] as const;
export const analysisErrorCodeSchema = z.enum(ANALYSIS_ERROR_CODES);

// ── 위험 조항(Clause Result) 계약 (0021 / TASK-004) ──
export const clauseRiskLevelSchema = z.enum(["high", "medium", "low"]);
// 조항 타입 9종 — 앱·API·worker 공유 단일 소스(값·순서 고정; DB enum 저장과 문자열 일치).
export const CLAUSE_TYPES = [
  "auto_renewal", // 자동 연장
  "penalty", // 위약금·지연 손해
  "termination_restriction", // 해지·환불 제한
  "liability", // 과도한 책임·면책
  "unilateral_change", // 일방적 변경
  "auto_payment", // 자동결제·갱신 과금
  "privacy_broad", // 광범위 개인정보 수집·제3자 제공
  "jurisdiction", // 관할·중재 강제
  "other", // 미분류
] as const;
export const clauseTypeSchema = z.enum(CLAUSE_TYPES);
// 원본(EXIF 정규화 upright) 픽셀 좌표. 화면 좌표 변환은 앱(4b).
export const boxSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const clauseSchema = z.object({
  id: z.string(),
  type: clauseTypeSchema,
  title: z.string(),
  description: z.string(),
  riskLevel: clauseRiskLevelSchema,
  sourceText: z.string(), // 판단 근거 원문
  boxes: z.array(boxSchema).min(1),
});

// ── 페이지별 결과 ──
// done일 때만 imageWidth/height·clauses·analysisComplete가 채워짐(하위호환 optional).
// analysisComplete=true = 분석 완료 마커 존재(정상 0건=true+[]; 미저장=false/undefined).
export const pageAnalysisResultSchema = z.object({
  pageId: z.string(),
  order: z.number().int().min(0),
  status: pageAnalysisStatusSchema,
  revision: z.number().int().positive(),
  errorCode: analysisErrorCodeSchema.optional(),
  retryable: z.boolean().optional(),
  imageWidth: z.number().int().positive().optional(), // 원본 upright 실측 치수
  imageHeight: z.number().int().positive().optional(),
  analysisComplete: z.boolean().optional(),
  clauses: z.array(clauseSchema).optional(),
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
export type ClauseRiskLevel = z.infer<typeof clauseRiskLevelSchema>;
export type ClauseType = z.infer<typeof clauseTypeSchema>;
export type Box = z.infer<typeof boxSchema>;
export type Clause = z.infer<typeof clauseSchema>;
export type PageAnalysisResult = z.infer<typeof pageAnalysisResultSchema>;
export type AnalysisStatusResponse = z.infer<typeof analysisStatusResponseSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
