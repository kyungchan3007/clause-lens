import { Injectable, Logger } from "@nestjs/common";
import {
  countHardDeleteCandidates,
  deleteDocumentRow,
  findHardDeleteCandidates,
  loadDocumentKeysData,
  recordDeletionAudit,
  transitionToDeleting,
} from "@clause-lens/db/analysis";

import { PrismaService } from "../../db/prisma.service";
import { StoragePort } from "../../ports/storage.port";
import { documentDeletionKeys } from "./retention.keys";

// 보관 만료 실삭제 잡(#164) — 무료(TEMPORARY)만. SAVED는 #165.
// 순서(크래시 안전): DELETING CAS → DB에서 키 열거 → 감사 기록 → S3 전 키 삭제 → (전부 성공 시만) 행 삭제.
// 멱등: S3 DeleteObject는 없는 객체도 성공(throw 안 함) → throw는 transient로 보고 행 삭제 중단(DELETING 잔류 복구).

export const RETENTION_SWEEP_DEFAULT_LIMIT = 100;
export const RETENTION_SWEEP_DEFAULT_MAX_CANDIDATES = 500; // 초과 시 run 전체 중단(폭주 방어)

export interface SweepPlanItem {
  documentId: string;
  userId: string;
  pageCount: number;
  keys: string[];
}
export interface DryRunReport {
  mode: "dry-run";
  totalCandidates: number;
  batch: number;
  plans: SweepPlanItem[];
}
export interface ExecuteReport {
  mode: "execute";
  totalCandidates: number;
  deleted: number;
  failed: number;
  skipped: number;
  aborted?: { reason: string; totalCandidates: number; cap: number };
}

@Injectable()
export class RetentionSweepService {
  private readonly logger = new Logger(RetentionSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  // 읽기 전용 계획(쓰기 없음). 건수·문서별 키 목록.
  async dryRun(limit = RETENTION_SWEEP_DEFAULT_LIMIT): Promise<DryRunReport> {
    const totalCandidates = await countHardDeleteCandidates(this.prisma);
    const candidates = await findHardDeleteCandidates(this.prisma, limit);
    const plans: SweepPlanItem[] = [];
    for (const c of candidates) {
      const data = await loadDocumentKeysData(this.prisma, c.documentId);
      if (!data) continue;
      plans.push({
        documentId: c.documentId,
        userId: c.userId,
        pageCount: data.pages.length,
        keys: documentDeletionKeys(c.documentId, data),
      });
    }
    this.logger.log(`[dry-run] 후보 ${totalCandidates}건 · 이번 배치 ${plans.length}건`);
    return { mode: "dry-run", totalCandidates, batch: plans.length, plans };
  }

  // 실삭제. 후보 수가 상한 초과면 run 전체 중단(슬라이스 아님).
  async execute(
    limit = RETENTION_SWEEP_DEFAULT_LIMIT,
    maxCandidates = RETENTION_SWEEP_DEFAULT_MAX_CANDIDATES,
  ): Promise<ExecuteReport> {
    // kill-switch(방어선): 환경변수로 하드 비활성화. 어떤 경로로 execute가 불려도 즉시 거부.
    const disabled = process.env.RETENTION_SWEEP_DISABLED;
    if (disabled === "1" || disabled === "true") {
      this.logger.warn("[execute] RETENTION_SWEEP_DISABLED 설정됨 — 실행 거부(kill-switch).");
      return {
        mode: "execute",
        totalCandidates: 0,
        deleted: 0,
        failed: 0,
        skipped: 0,
        aborted: { reason: "kill_switch_disabled", totalCandidates: 0, cap: maxCandidates },
      };
    }

    const totalCandidates = await countHardDeleteCandidates(this.prisma);
    if (totalCandidates > maxCandidates) {
      this.logger.error(
        `[execute] 후보 ${totalCandidates}건 > 상한 ${maxCandidates} — run 중단(폭주 방어). dry-run으로 확인 필요.`,
      );
      return {
        mode: "execute",
        totalCandidates,
        deleted: 0,
        failed: 0,
        skipped: 0,
        aborted: { reason: "candidate_count_over_cap", totalCandidates, cap: maxCandidates },
      };
    }

    const candidates = await findHardDeleteCandidates(this.prisma, limit);
    let deleted = 0;
    let failed = 0;
    let skipped = 0;

    for (const c of candidates) {
      // ① DELETING CAS(후보 술어 재검증). 사이에 저장/만료 변경 시 0행 → skip.
      const flipped = await transitionToDeleting(this.prisma, c.documentId);
      if (!flipped) {
        skipped++;
        continue;
      }
      // ② 행 삭제 전에 키 열거(랜덤 finalKey는 DB에만).
      const data = await loadDocumentKeysData(this.prisma, c.documentId);
      if (!data) {
        skipped++;
        continue;
      }
      const keys = documentDeletionKeys(c.documentId, data);
      // ③ 감사 기록(삭제 전 — 유일한 포렌식 흔적).
      await recordDeletionAudit(this.prisma, {
        documentId: c.documentId,
        userId: data.userId,
        reason: "free_expired",
        keys,
        pageCount: data.pages.length,
      });
      // ④ S3 전 키 삭제. 하나라도 실패(transient)면 행 삭제 중단 → DELETING 잔류(다음 실행 복구).
      const allDeleted = await this.deleteKeys(keys, c.documentId);
      if (!allDeleted) {
        failed++;
        continue;
      }
      // ⑤ 전 키 성공 확인 후에만 행 삭제(cascade).
      await deleteDocumentRow(this.prisma, c.documentId);
      deleted++;
    }

    this.logger.log(
      `[execute] 후보 ${totalCandidates} · 삭제 ${deleted} · 실패 ${failed} · skip ${skipped}`,
    );
    return { mode: "execute", totalCandidates, deleted, failed, skipped };
  }

  // 키 전부 삭제 시도. 멱등 계약: 없는 객체(NotFound)는 성공 처리, 그 외(transient 5xx/timeout)만 false(행 삭제 중단).
  // DeleteObject는 보통 없는 객체에도 throw하지 않지만, 어댑터가 NotFound를 던져도 설계대로 성공 취급.
  private async deleteKeys(keys: string[], documentId: string): Promise<boolean> {
    let ok = true;
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (e) {
        if (isNotFoundError(e)) continue; // 없는 객체 = 성공(멱등)
        ok = false;
        this.logger.warn(
          `[execute] S3 삭제 실패(doc ${documentId}) — 행 삭제 보류: ${(e as Error).message}`,
        );
      }
    }
    return ok;
  }
}

// S3/스토리지 NotFound 계열 판별. NotFound만 멱등 성공으로 취급.
// SDK v3($metadata.httpStatusCode)·name/Code뿐 아니라 래퍼/라이브러리가 최상위로 노출하는
// statusCode/status(숫자 또는 문자열 404)까지 커버 — 하나라도 놓치면 DELETING 영구 잔류 위험.
export function isNotFoundError(e: unknown): boolean {
  const err = e as {
    name?: string;
    Code?: string;
    code?: string;
    statusCode?: number | string;
    status?: number | string;
    $metadata?: { httpStatusCode?: number };
  };
  const is404 = (v: unknown): boolean => v === 404 || v === "404";
  return (
    err?.name === "NotFound" ||
    err?.name === "NoSuchKey" ||
    err?.Code === "NoSuchKey" ||
    err?.code === "NoSuchKey" ||
    is404(err?.$metadata?.httpStatusCode) ||
    is404(err?.statusCode) ||
    is404(err?.status)
  );
}
