import type { DocumentListItem, DocumentListResponse } from "@clause-lens/contracts";

import { useDocumentsStore } from "./documentsStore";
import { fetchRecentDocuments } from "../api/documentsApi";
import { getAccessToken } from "../../auth";

jest.mock("../api/documentsApi");
jest.mock("../../auth", () => ({ getAccessToken: jest.fn() }));

const fetchMock = fetchRecentDocuments as jest.MockedFunction<typeof fetchRecentDocuments>;
const tokenMock = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

const item = (id: string): DocumentListItem => ({
  documentId: id,
  completedAt: "2026-10-01T05:00:00.000Z",
  retainUntil: "2026-10-08T05:00:00.000Z",
  status: "done",
  totalPageCount: 1,
  analyzedPageCount: 1,
  risk: { high: 0, medium: 0, low: 0 },
  label: "계약서 · 1장",
});
const page = (ids: string[], nextCursor: string | null = null): DocumentListResponse => ({
  items: ids.map(item),
  nextCursor,
});

const flush = () => new Promise<void>((r) => setImmediate(r));
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}
const store = () => useDocumentsStore.getState();

beforeEach(() => {
  useDocumentsStore.setState({
    status: "idle",
    items: [],
    nextCursor: null,
    loadingMore: false,
    generation: 0,
    userId: "u1",
    refreshing: false,
  });
  jest.clearAllMocks();
  tokenMock.mockResolvedValue("tkn");
});

describe("documentsStore.refresh", () => {
  it("성공 → ready + items/nextCursor", async () => {
    fetchMock.mockResolvedValue(page(["a", "b"], "CUR"));
    await store().refresh();
    expect(store().status).toBe("ready");
    expect(store().items.map((i) => i.documentId)).toEqual(["a", "b"]);
    expect(store().nextCursor).toBe("CUR");
  });

  it("최초 실패 → error, 기존 목록 있으면 유지(조용히)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("net"));
    await store().refresh();
    expect(store().status).toBe("error");

    // 목록이 생긴 뒤 재조회 실패 → 기존 유지.
    fetchMock.mockResolvedValueOnce(page(["a"]));
    await store().refresh();
    expect(store().items).toHaveLength(1);
    fetchMock.mockRejectedValueOnce(new Error("net2"));
    await store().refresh();
    expect(store().items).toHaveLength(1); // 유지
    expect(store().status).toBe("ready");
  });

  it("조회 도중 계정 변경 → 응답 폐기", async () => {
    const d = deferred<DocumentListResponse>();
    fetchMock.mockReturnValue(d.promise);
    const p = store().refresh();
    store().syncAccount("u2"); // 세대++
    d.resolve(page(["a"]));
    await p;
    await flush();
    expect(store().items).toHaveLength(0); // 폐기됨
  });
});

describe("documentsStore.loadMore", () => {
  it("다음 페이지 append + 중복 제거", async () => {
    fetchMock.mockResolvedValueOnce(page(["a", "b"], "CUR"));
    await store().refresh();
    fetchMock.mockResolvedValueOnce(page(["b", "c"], null)); // b 중복
    await store().loadMore();
    expect(store().items.map((i) => i.documentId)).toEqual(["a", "b", "c"]);
    expect(store().nextCursor).toBeNull();
  });

  it("nextCursor 없으면 no-op", async () => {
    useDocumentsStore.setState({ nextCursor: null });
    await store().loadMore();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("documentsStore.removeDocument / syncAccount", () => {
  it("removeDocument는 해당 문서만 제거", async () => {
    fetchMock.mockResolvedValue(page(["a", "b", "c"]));
    await store().refresh();
    store().removeDocument("b");
    expect(store().items.map((i) => i.documentId)).toEqual(["a", "c"]);
  });

  it("계정 변경 → 목록 초기화(이전 사용자 미노출)", async () => {
    fetchMock.mockResolvedValue(page(["a"]));
    await store().refresh();
    store().syncAccount("other");
    expect(store().items).toHaveLength(0);
    expect(store().status).toBe("idle");
  });

  it("같은 userId면 유지(토큰 갱신)", async () => {
    fetchMock.mockResolvedValue(page(["a"]));
    await store().refresh();
    store().syncAccount("u1");
    expect(store().items).toHaveLength(1);
  });
});
