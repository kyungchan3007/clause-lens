import { useCallback } from "react";
import * as FileSystem from "expo-file-system/legacy";
import type { UploadTicket } from "@clause-lens/contracts";

import * as uploadApi from "../api/uploadApi";
import { HttpError } from "../api/uploadApi";
import { useUploadStore } from "./uploadStore";

// app 레이어가 주입: 호출 직전 현재 토큰·소유자. 장기 캡처 금지.
export interface UploadAuth {
  accessToken: string;
  userId: string;
}
export type GetUploadAuth = () => Promise<UploadAuth | null>;

// app 레이어가 Draft에서 만든 불변 스냅샷(업로드 중 편집 잠금 전제).
export interface UploadPageSnapshot {
  draftId: string;
  localUri: string;
  order: number;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

const genClientRequestId = () =>
  `cl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

// 취소용 진행 중 task 참조.
let activeTask: FileSystem.UploadTask | null = null;

const ACTIVE_PHASES = ["presigning", "uploading", "confirming"] as const;

export function useUpload() {
  const start = useCallback(
    async (snapshots: UploadPageSnapshot[], getAuth: GetUploadAuth) => {
      const store = useUploadStore.getState();
      if ((ACTIVE_PHASES as readonly string[]).includes(store.phase)) return; // 실행 잠금(첫 await 이전)

      const myRun = store.runId + 1;
      const clientRequestId = store.clientRequestId ?? genClientRequestId();
      useUploadStore.getState().set({
        phase: "presigning",
        runId: myRun,
        clientRequestId,
        documentId: undefined,
        ownerUserId: undefined,
        sentCount: 0,
        totalCount: snapshots.length,
        message: undefined,
        pages: snapshots.map((s) => ({
          draftId: s.draftId,
          order: s.order,
          put: false,
          server: "pending" as const,
        })),
      });

      try {
        const auth = await getAuth();
        if (!alive(myRun)) return;
        if (!auth) return fail(myRun, "로그인이 필요해요.");
        useUploadStore.getState().set({ ownerUserId: auth.userId });

        // presign(요청도 계약 검증) → order로 매핑, 집합 검증
        const pre = await uploadApi.presign(auth.accessToken, {
          clientRequestId,
          pages: snapshots.map((s) => ({
            order: s.order,
            contentType: s.contentType as "image/jpeg",
            sizeBytes: s.sizeBytes,
            width: s.width,
            height: s.height,
          })),
        });
        if (!alive(myRun)) return;
        const byOrder = mapByOrder(snapshots, pre.pages);
        if (!byOrder) return fail(myRun, "서버 응답이 요청과 일치하지 않아요.");

        useUploadStore.getState().set({
          documentId: pre.documentId,
          phase: "uploading",
          pages: snapshots.map((s) => ({
            draftId: s.draftId,
            order: s.order,
            pageId: byOrder.get(s.order)!.pageId,
            put: false,
            server: "pending" as const,
          })),
        });

        // 순차 PUT(진행 n/N). 403→해당 페이지 1회 재발급 후 재시도.
        for (const s of snapshots) {
          if (!alive(myRun)) return;
          const ticket = byOrder.get(s.order)!;
          await putWithRetry(myRun, auth, pre.documentId, s, ticket);
        }
        if (!alive(myRun)) return;

        await confirm(myRun, auth, pre.documentId, snapshots);
      } catch (e) {
        if (!alive(myRun)) return;
        fail(myRun, describeError(e));
      }
    },
    [],
  );

  // 미확정 페이지만 재발급→PUT→complete(멱등). 세션 내 복구.
  const retry = useCallback(
    async (snapshots: UploadPageSnapshot[], getAuth: GetUploadAuth) => {
      const store = useUploadStore.getState();
      if ((ACTIVE_PHASES as readonly string[]).includes(store.phase)) return;
      if (!store.documentId) return start(snapshots, getAuth);

      const myRun = store.runId + 1;
      const documentId = store.documentId;
      useUploadStore.getState().set({ phase: "uploading", runId: myRun, message: undefined });

      try {
        const auth = await getAuth();
        if (!alive(myRun)) return;
        if (!auth) return fail(myRun, "로그인이 필요해요.");
        if (auth.userId !== store.ownerUserId) {
          return fail(myRun, "계정이 변경되어 업로드를 중단했어요.");
        }

        const pending = useUploadStore
          .getState()
          .pages.filter((p) => p.server !== "uploaded" && p.pageId);
        const snapById = new Map(snapshots.map((s) => [s.draftId, s]));

        if (pending.length > 0) {
          const rep = await uploadApi.reprisign(
            auth.accessToken,
            documentId,
            pending.map((p) => p.pageId!),
          );
          if (!alive(myRun)) return;
          for (const ticket of rep.pages) {
            if (!alive(myRun)) return;
            const p = pending.find((x) => x.pageId === ticket.pageId);
            const snap = p && snapById.get(p.draftId);
            if (!snap) continue;
            await putWithRetry(myRun, auth, documentId, snap, ticket);
          }
          if (!alive(myRun)) return;
        }
        // reprisign이 비어도(이미 서버 확정 가능) complete로 확인 — 알고 있는 pageIds로.
        await confirm(myRun, auth, documentId, snapshots);
      } catch (e) {
        if (!alive(myRun)) return;
        fail(myRun, describeError(e));
      }
    },
    [start],
  );

  // 취소: 실행 무효화(runId bump) + 진행 중 전송 중단. 서버 반영은 재시도 때 확인.
  const cancel = useCallback(() => {
    const store = useUploadStore.getState();
    store.set({ runId: store.runId + 1, phase: "idle", message: "취소했어요." });
    void activeTask?.cancelAsync().catch(() => {});
    activeTask = null;
  }, []);

  return { start, retry, cancel };
}

// ── 내부 헬퍼 ──

function alive(runId: number): boolean {
  return useUploadStore.getState().runId === runId;
}

function fail(runId: number, message: string): void {
  if (!alive(runId)) return;
  useUploadStore.getState().set({ phase: "error", message });
}

// presign/reprisign 응답 order↔요청 대응 검증(집합 검증). 불일치면 null.
function mapByOrder(
  snapshots: UploadPageSnapshot[],
  tickets: UploadTicket[],
): Map<number, UploadTicket> | null {
  if (tickets.length !== snapshots.length) return null;
  const byOrder = new Map<number, UploadTicket>();
  for (const t of tickets) {
    if (byOrder.has(t.order)) return null; // 중복 order
    byOrder.set(t.order, t);
  }
  for (const s of snapshots) {
    if (!byOrder.has(s.order)) return null;
  }
  return byOrder;
}

// 단일 파일 PUT + HTTP status 확인(Promise 완료·null ≠ 성공). 403 1회 재발급.
async function putWithRetry(
  runId: number,
  auth: UploadAuth,
  documentId: string,
  snap: UploadPageSnapshot,
  ticket: UploadTicket,
): Promise<void> {
  try {
    await putOnce(runId, ticket.uploadUrl, snap);
    markPage(snap.draftId, { put: true });
    bumpSent();
  } catch (e) {
    if (e instanceof PutHttpError && e.status === 403) {
      // URL 만료 가능 → 1회 재발급 후 재시도. 재차 403이면 실패.
      try {
        const rep = await uploadApi.reprisign(auth.accessToken, documentId, [ticket.pageId]);
        if (!alive(runId)) return;
        const fresh = rep.pages.find((p) => p.pageId === ticket.pageId);
        if (fresh) {
          await putOnce(runId, fresh.uploadUrl, snap);
          markPage(snap.draftId, { put: true });
          bumpSent();
          return;
        }
      } catch {
        // fallthrough → 실패 표기
      }
    }
    markPage(snap.draftId, { put: false, error: "put_failed", retryable: true });
  }
}

class PutHttpError extends Error {
  constructor(readonly status: number) {
    super(`PUT ${status}`);
  }
}

async function putOnce(
  runId: number,
  uploadUrl: string,
  snap: UploadPageSnapshot,
): Promise<void> {
  const task = FileSystem.createUploadTask(uploadUrl, snap.localUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    headers: { "Content-Type": snap.contentType },
  });
  activeTask = task;
  const res = await task.uploadAsync();
  activeTask = null;
  if (!alive(runId)) throw new Error("stale");
  if (!res || res.status < 200 || res.status >= 300) {
    throw new PutHttpError(res?.status ?? 0);
  }
}

// complete → 페이지별 서버 상태 반영. 전체 uploaded면 완료, 아니면 error(부분).
async function confirm(
  runId: number,
  auth: UploadAuth,
  documentId: string,
  snapshots: UploadPageSnapshot[],
): Promise<void> {
  useUploadStore.getState().set({ phase: "confirming" });
  const pageIds = useUploadStore
    .getState()
    .pages.map((p) => p.pageId)
    .filter((id): id is string => !!id);
  const done = await uploadApi.complete(auth.accessToken, documentId, pageIds);
  if (!alive(runId)) return;

  const resultById = new Map(done.pages.map((p) => [p.pageId, p]));
  const pages = useUploadStore.getState().pages.map((p) => {
    const r = p.pageId ? resultById.get(p.pageId) : undefined;
    if (!r) return p;
    return {
      ...p,
      server: r.status,
      error: r.error,
      retryable: r.retryable,
    };
  });
  useUploadStore.getState().set({
    pages,
    phase: done.status === "uploaded" ? "uploaded" : "error",
    message:
      done.status === "uploaded" ? undefined : "일부 페이지 업로드에 실패했어요.",
  });
}

function markPage(
  draftId: string,
  patch: Partial<{ put: boolean; error?: string; retryable?: boolean }>,
): void {
  const pages = useUploadStore
    .getState()
    .pages.map((p) => (p.draftId === draftId ? { ...p, ...patch } : p));
  useUploadStore.getState().set({ pages });
}

function bumpSent(): void {
  useUploadStore.getState().set({ sentCount: useUploadStore.getState().sentCount + 1 });
}

// HTTP/스키마 오류를 사용자 문구로(원문·상태 로깅 금지).
function describeError(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.status === 401) return "로그인이 필요해요.";
    if (e.status === 409) return "이미 처리 중이거나 만료된 세션이에요. 다시 시도해주세요.";
    return "업로드 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.";
  }
  return "업로드 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.";
}
