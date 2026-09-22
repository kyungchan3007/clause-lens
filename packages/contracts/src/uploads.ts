import { z } from "zod";

// 업로드(presign/complete) 계약 — 앱↔API 단일 소스(타입 + 런타임 검증).
// 설계: agents/intent/specs/0018-uploads-presign.md

// ── 상수(서버·클라 공유) ──
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_PAGE_SIZE_BYTES = 15 * 1024 * 1024; // 페이지당 15MB
export const MAX_PAGES_PER_DOCUMENT = 20;
export const MAX_PENDING_DOCUMENTS_PER_USER = 5; // 만료 세션 제외(서버 판단)

export const imageMimeSchema = z.enum(ALLOWED_IMAGE_MIME);

// ── presign 요청 ──
export const presignPageInputSchema = z.object({
  order: z.number().int().min(0),
  contentType: imageMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_PAGE_SIZE_BYTES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const presignRequestSchema = z.object({
  // 멱등키: 첫 요청 전 클라가 생성·영속. 같은 값=같은 세션.
  clientRequestId: z.string().min(1).max(100),
  pages: z
    .array(presignPageInputSchema)
    .min(1)
    .max(MAX_PAGES_PER_DOCUMENT)
    .refine(
      (pages) => new Set(pages.map((p) => p.order)).size === pages.length,
      { message: "pages[].order must be unique" },
    ),
});

// ── presign/reprisign 응답 (발급된 업로드 티켓) ──
export const uploadTicketSchema = z.object({
  pageId: z.string(),
  order: z.number().int().min(0),
  tmpKey: z.string(), // 임시키(앱이 PUT). 최종 참조 아님
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(), // URL 만료(ISO)
});

export const presignResponseSchema = z.object({
  documentId: z.string(),
  sessionExpiresAt: z.string().datetime(), // 세션 만료(URL TTL과 분리)
  pages: z.array(uploadTicketSchema),
});

// ── reprisign(미확정 페이지 URL 재발급) ──
export const reprisignRequestSchema = z.object({
  pageIds: z.array(z.string()).min(1).max(MAX_PAGES_PER_DOCUMENT),
});
export const reprisignResponseSchema = z.object({
  documentId: z.string(),
  pages: z.array(uploadTicketSchema),
});

// ── complete(확정) ──
export const completeRequestSchema = z.object({
  pageIds: z.array(z.string()).min(1).max(MAX_PAGES_PER_DOCUMENT),
});

export const documentStatusSchema = z.enum([
  "draft",
  "uploaded",
  "analyzing",
  "done",
  "failed",
  "expired",
]);

// 페이지별 결과 — 실패는 영속 상태가 아니라 응답 코드/재시도가능 여부로 표현
export const pageResultSchema = z.object({
  pageId: z.string(),
  status: z.enum(["pending", "uploaded"]),
  error: z.string().optional(),
  retryable: z.boolean().optional(),
});

export const completeResponseSchema = z.object({
  documentId: z.string(),
  status: documentStatusSchema,
  pages: z.array(pageResultSchema),
});

// ── 추론 타입 ──
export type ImageMime = z.infer<typeof imageMimeSchema>;
export type PresignPageInput = z.infer<typeof presignPageInputSchema>;
export type PresignRequest = z.infer<typeof presignRequestSchema>;
export type UploadTicket = z.infer<typeof uploadTicketSchema>;
export type PresignResponse = z.infer<typeof presignResponseSchema>;
export type ReprisignRequest = z.infer<typeof reprisignRequestSchema>;
export type ReprisignResponse = z.infer<typeof reprisignResponseSchema>;
export type CompleteRequest = z.infer<typeof completeRequestSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type PageResult = z.infer<typeof pageResultSchema>;
export type CompleteResponse = z.infer<typeof completeResponseSchema>;
