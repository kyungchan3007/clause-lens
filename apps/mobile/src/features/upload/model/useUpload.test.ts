import { renderHook } from "@testing-library/react-native";

import * as uploadApi from "../api/uploadApi";
import { useUpload, type UploadPageSnapshot } from "./useUpload";
import { useUploadStore } from "./uploadStore";

jest.mock("../api/uploadApi", () => ({
  ...jest.requireActual("../api/uploadApi"),
  presign: jest.fn(),
  reprisign: jest.fn(),
  complete: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  FileSystemUploadType: { BINARY_CONTENT: 1 },
  FileSystemSessionType: { FOREGROUND: 0 },
  createUploadTask: jest.fn(() => ({
    uploadAsync: jest.fn().mockResolvedValue({ status: 200 }),
    cancelAsync: jest.fn().mockResolvedValue(undefined),
  })),
}));

const api = uploadApi as jest.Mocked<typeof uploadApi>;

const snap: UploadPageSnapshot[] = [
  {
    draftId: "d1",
    localUri: "file://x.jpg",
    order: 0,
    contentType: "image/jpeg",
    sizeBytes: 1000,
    width: 10,
    height: 10,
  },
];
const getAuth = async () => ({ accessToken: "t", userId: "u" });

const presignOk = {
  documentId: "doc1",
  sessionExpiresAt: "2026-09-22T10:00:00.000Z",
  pages: [
    { pageId: "pg1", order: 0, tmpKey: "k", uploadUrl: "https://m/put", expiresAt: "2026-09-22T09:10:00.000Z" },
  ],
};

beforeEach(() => {
  useUploadStore.getState().reset();
  useUploadStore.setState({ runId: 0 });
  jest.clearAllMocks();
});

describe("useUpload.start", () => {
  it("정상 흐름 → uploaded", async () => {
    api.presign.mockResolvedValue(presignOk);
    api.complete.mockResolvedValue({
      documentId: "doc1",
      status: "uploaded",
      pages: [{ pageId: "pg1", status: "uploaded" }],
    });

    const { result } = renderHook(() => useUpload());
    await result.current.start(snap, getAuth);

    expect(api.presign).toHaveBeenCalledTimes(1);
    expect(api.complete).toHaveBeenCalledWith("t", "doc1", ["pg1"]);
    expect(useUploadStore.getState().phase).toBe("uploaded");
    expect(useUploadStore.getState().pages[0].server).toBe("uploaded");
  });

  it("인증 없음 → error, presign 미호출", async () => {
    const { result } = renderHook(() => useUpload());
    await result.current.start(snap, async () => null);
    expect(api.presign).not.toHaveBeenCalled();
    expect(useUploadStore.getState().phase).toBe("error");
  });

  it("응답 order 불일치 → 계약오류 error, complete 미호출", async () => {
    api.presign.mockResolvedValue({
      ...presignOk,
      pages: [{ ...presignOk.pages[0], order: 5 }],
    });
    const { result } = renderHook(() => useUpload());
    await result.current.start(snap, getAuth);
    expect(api.complete).not.toHaveBeenCalled();
    expect(useUploadStore.getState().phase).toBe("error");
  });

  it("부분 실패(complete pending) → error + retryable 반영", async () => {
    api.presign.mockResolvedValue(presignOk);
    api.complete.mockResolvedValue({
      documentId: "doc1",
      status: "draft",
      pages: [{ pageId: "pg1", status: "pending", error: "copy_failed", retryable: true }],
    });
    const { result } = renderHook(() => useUpload());
    await result.current.start(snap, getAuth);
    expect(useUploadStore.getState().phase).toBe("error");
    expect(useUploadStore.getState().pages[0].retryable).toBe(true);
  });
});
