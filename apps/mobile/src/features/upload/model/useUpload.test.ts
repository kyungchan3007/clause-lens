import { renderHook } from "@testing-library/react-native";

import { HttpError } from "../../../shared/http";
import * as uploadApi from "../api/uploadApi";
import { describeError, useUpload, type UploadPageSnapshot } from "./useUpload";
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

describe("describeError (401/409 전용 문구, 그 외 제네릭)", () => {
  const GENERIC = "업로드 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.";

  it("401(auth)은 로그인 문구", () => {
    expect(describeError(new HttpError(401))).toBe("로그인이 필요해요.");
  });

  it("409(conflict)는 재시도 문구", () => {
    expect(describeError(new HttpError(409))).toBe(
      "이미 처리 중이거나 만료된 세션이에요. 다시 시도해주세요.",
    );
  });

  it("403·비HttpError·네트워크는 제네릭 문구(기존 동작 보존)", () => {
    expect(describeError(new HttpError(403))).toBe(GENERIC);
    expect(describeError(new Error("network"))).toBe(GENERIC);
    expect(describeError(undefined)).toBe(GENERIC);
  });

  it("크로스모듈 HttpError(구조만 같은 객체)도 status로 분류한다", () => {
    expect(describeError({ status: 401 })).toBe("로그인이 필요해요.");
    expect(describeError({ status: 409 })).toBe(
      "이미 처리 중이거나 만료된 세션이에요. 다시 시도해주세요.",
    );
  });
});
