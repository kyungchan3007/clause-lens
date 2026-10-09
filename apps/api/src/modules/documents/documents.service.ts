import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ANALYSIS_INCOMPLETE_CODE,
  MAX_PENDING_DOCUMENTS_PER_USER,
  RETENTION_EXPIRED_CODE,
  SUBSCRIPTION_REQUIRED_CODE,
  type DocumentListResponse,
  type PresignPageInput,
  type SaveDocumentResponse,
} from "@clause-lens/contracts";
import {
  documentVisible,
  isRetentionActive,
  isUniqueViolation,
} from "@clause-lens/db/analysis";

import {
  decodeCursor,
  toListResponse,
} from "./documents-list.mapper";

import {
  type AnalysisJobWithPages,
  type DocumentWithPages,
  DocumentsRepository,
  type PageConfirmation,
  QuotaExceededError,
} from "./documents.repository";

// 세션 만료(정리 기준). URL TTL과 분리.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Document/Page 상태의 소유자(공개 서비스). uploads는 이 서비스로만 상태를 바꾼다.
@Injectable()
export class DocumentsService {
  constructor(private readonly repo: DocumentsRepository) {}

  // 멱등 세션 생성/재사용. 같은 (userId, clientRequestId)=같은 세션, 다른 payload=409.
  async createOrGetSession(
    userId: string,
    clientRequestId: string,
    pages: PresignPageInput[],
  ): Promise<DocumentWithPages> {
    const existing = await this.repo.findSessionByKey(userId, clientRequestId);
    if (existing) {
      if (existing.status === "expired") {
        throw new ConflictException(
          "세션이 만료되었습니다. 새 요청으로 시작하세요.",
        );
      }
      if (!samePayload(existing, pages)) {
        throw new ConflictException(
          "같은 요청 키로 다른 내용을 보낼 수 없습니다.",
        );
      }
      return existing;
    }

    const pending = await this.repo.countPendingSessions(userId, new Date());
    if (pending >= MAX_PENDING_DOCUMENTS_PER_USER) {
      throw new ConflictException(
        "미완료 업로드 세션이 너무 많습니다. 기존 세션을 완료하거나 잠시 후 다시 시도하세요.",
      );
    }

    return this.repo.createSession(
      userId,
      clientRequestId,
      pages.map((p) => ({
        order: p.order,
        contentType: p.contentType,
        expectedSize: p.sizeBytes,
        width: p.width,
        height: p.height,
      })),
      new Date(Date.now() + SESSION_TTL_MS),
    );
  }

  async getOwnedSession(
    userId: string,
    documentId: string,
  ): Promise<DocumentWithPages> {
    const doc = await this.repo.findOwnedSession(userId, documentId);
    if (!doc) throw new NotFoundException("문서를 찾을 수 없습니다.");
    return doc;
  }

  // 검증·copy를 마친 페이지들을 원자적으로 확정(전체 uploaded일 때만 Document uploaded).
  async confirmPages(
    userId: string,
    documentId: string,
    confirmations: PageConfirmation[],
  ): Promise<DocumentWithPages> {
    const doc = await this.repo.confirmPagesTx(
      userId,
      documentId,
      confirmations,
      new Date(),
    );
    if (!doc) throw new NotFoundException("문서를 찾을 수 없습니다.");
    return doc;
  }

  // ── 분석 (#16) ──

  // 분석 접수(멱등). 검사 순서: 소유권 → 기존 분석(활성/terminal) 반환 → (없을 때만) 자격(uploaded).
  async startAnalysis(
    userId: string,
    documentId: string,
  ): Promise<AnalysisJobWithPages> {
    const doc = await this.repo.findOwnedSession(userId, documentId);
    if (!doc) throw new NotFoundException("문서를 찾을 수 없습니다.");

    const existing = await this.repo.findLatestAnalysis(documentId);
    if (existing) return existing; // terminal 포함 — 재분석은 비목표

    if (doc.status !== "uploaded") {
      throw new ConflictException(
        "업로드가 확정된 문서만 분석할 수 있습니다.",
      );
    }

    try {
      return await this.repo.createAnalysisJob(
        documentId,
        userId,
        doc.pages.map((p) => ({ pageId: p.id, revision: p.revision })),
      );
    } catch (e) {
      // 동시 접수 경쟁(부분 유니크 인덱스) → 승자 job 재조회.
      if (isUniqueViolation(e)) {
        const winner = await this.repo.findLatestAnalysis(documentId);
        if (winner) return winner;
      }
      // 가용 무료 횟수 없음 → 권한 안내(앱이 로그인·구독으로 연결).
      if (e instanceof QuotaExceededError) {
        throw new ForbiddenException("무료 분석 횟수를 모두 사용했습니다.");
      }
      throw e;
    }
  }

  // 현재 분석 상태 조회(진실의 기준). 소유권 확인 후 최신 job 반환.
  // 재열람 보관 게이트(0030): retainUntil이 설정됐고(=terminal) 지났으면 410(접근 차단).
  // retainUntil null(진행중)은 통과 — 진행중 폴링을 막지 않음. 세션 TTL(24h)은 재열람에 무관.
  async getAnalysis(
    userId: string,
    documentId: string,
  ): Promise<AnalysisJobWithPages> {
    const doc = await this.repo.findOwnedSession(userId, documentId);
    if (!doc) throw new NotFoundException("문서를 찾을 수 없습니다.");
    // 보관 가시성 공유 판정(#163): SAVED는 retainUntil 경과해도 통과, TEMPORARY 만료는 410.
    // (소유자 확인을 가시성보다 먼저 — 비소유자가 상태를 구분하지 못하게.)
    if (!documentVisible(doc)) {
      throw new GoneException("보관 기간이 지나 다시 볼 수 없습니다.");
    }
    const job = await this.repo.findLatestAnalysis(documentId);
    if (!job) throw new NotFoundException("분석 요청이 없습니다.");
    return job;
  }

  // 분석 결과 장기 보관 전환(저장하기, #163 / TASK-006 ②). 멱등.
  // 결정표(bare rowcount로 분기 금지 — 존재 누출 방지):
  //   미소유 404 → 이미 SAVED 200(멱등) → 미구독 403 → CAS 1행 200 → 0행이면 재조회로 분기.
  // CAS(saveDocumentCas)가 전환의 단일 권위. pre-load/재조회는 에러코드 산출용.
  async saveDocument(
    userId: string,
    documentId: string,
  ): Promise<SaveDocumentResponse> {
    const now = new Date();
    const doc = await this.repo.findOwnedSession(userId, documentId);
    if (!doc) throw new NotFoundException("문서를 찾을 수 없습니다.");
    // 이미 저장됨 → 멱등 성공(SAVED는 영속 권리 — 구독 재확인 없이).
    if (doc.retentionState === "SAVED") {
      return { documentId: doc.id, retentionState: "SAVED", savedAt: (doc.savedAt ?? now).toISOString() };
    }
    // 보관 권한(미구독 403). 만료/미완료보다 먼저 — 권한이 1차 게이트.
    const canSave = await this.repo.userCanSave(userId, now);
    if (!canSave) {
      throw new ForbiddenException({ code: SUBSCRIPTION_REQUIRED_CODE, message: "저장은 구독이 필요한 기능입니다." });
    }
    // 원자적 전환(단일 권위). pre-load 이후 만료/경쟁은 0행으로 포착.
    const updated = await this.repo.saveDocumentCas(userId, documentId);
    if (updated === 1) {
      return { documentId, retentionState: "SAVED", savedAt: new Date().toISOString() };
    }
    // 0행 → 재조회로 사유 분기.
    const after = await this.repo.findOwnedSession(userId, documentId);
    if (!after) throw new NotFoundException("문서를 찾을 수 없습니다.");
    if (after.retentionState === "SAVED") {
      // 동시 더블탭 경쟁의 패자 → 멱등 성공.
      return { documentId: after.id, retentionState: "SAVED", savedAt: (after.savedAt ?? now).toISOString() };
    }
    if (after.status !== "done" && after.status !== "partial") {
      throw new ConflictException({ code: ANALYSIS_INCOMPLETE_CODE, message: "완료된 분석만 저장할 수 있습니다." });
    }
    if (!isRetentionActive(after.retainUntil, now)) {
      throw new GoneException({ code: RETENTION_EXPIRED_CODE, message: "보관 기간이 지나 저장할 수 없습니다." });
    }
    // 전이 가능해 보이는데 CAS 0행(시계 skew 경쟁) → 재시도 유도.
    throw new ConflictException("저장을 완료하지 못했습니다. 다시 시도해 주세요.");
  }

  // 재열람 가능한 최근 분석 문서 목록(#96 / 0030). 소유자·done|partial·retainUntil>now.
  async listRecentDocuments(
    userId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<DocumentListResponse> {
    const before = decodeCursor(params.cursor);
    const page = await this.repo.listRecentDocuments(userId, {
      limit: params.limit,
      before,
    });
    return toListResponse(page.items, page.hasMore);
  }

  markDispatched(jobId: string): Promise<void> {
    return this.repo.markDispatched(jobId);
  }

  findUndispatchedActiveJobIds(before: Date): Promise<string[]> {
    return this.repo.findUndispatchedActiveJobIds(before);
  }
}

// 기존 세션의 페이지와 요청 payload가 동일한지(멱등 충돌 판정).
function samePayload(doc: DocumentWithPages, pages: PresignPageInput[]): boolean {
  if (doc.pages.length !== pages.length) return false;
  const byOrder = new Map(doc.pages.map((p) => [p.order, p]));
  return pages.every((p) => {
    const existing = byOrder.get(p.order);
    return (
      existing != null &&
      existing.contentType === p.contentType &&
      existing.expectedSize === p.sizeBytes
    );
  });
}
