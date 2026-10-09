import { act, renderHook } from "@testing-library/react-native";

import { HttpError } from "../../../shared/http";
import type { SaveOutcome } from "./useSaveDocument";

// 네이티브/배럴 의존을 끊고 순수 로직(결과 매핑·목록 반영)만 검증.
jest.mock("../../auth", () => ({ getAccessToken: jest.fn() }));
jest.mock("../api/documentsApi", () => ({ saveDocument: jest.fn() }));
jest.mock("./documentsStore", () => {
  const { create } = jest.requireActual("zustand");
  const refresh = jest.fn().mockResolvedValue(undefined);
  return { useDocumentsStore: create(() => ({ refresh })) };
});

import { getAccessToken } from "../../auth";
import { saveDocument } from "../api/documentsApi";
import { useDocumentsStore } from "./documentsStore";
import { useSaveDocument } from "./useSaveDocument";

const mockToken = getAccessToken as unknown as jest.Mock;
const mockSave = saveDocument as unknown as jest.Mock;
const refresh = (useDocumentsStore as unknown as { getState: () => { refresh: jest.Mock } }).getState().refresh;

beforeEach(() => {
  jest.clearAllMocks();
  mockToken.mockResolvedValue("tkn");
});

// setSaving 상태 갱신을 act로 감싸 경고 제거.
async function runSave(documentId: string | undefined): Promise<SaveOutcome> {
  const { result } = renderHook(() => useSaveDocument(documentId));
  let outcome: SaveOutcome = "error";
  await act(async () => {
    outcome = await result.current.save();
  });
  return outcome;
}

describe("useSaveDocument (#163)", () => {
  it("성공 → 'saved' + 목록 refresh 호출", async () => {
    mockSave.mockResolvedValue({ documentId: "doc1", retentionState: "SAVED", savedAt: "2026-10-09T01:00:00.000Z" });
    expect(await runSave("doc1")).toBe("saved");
    expect(mockSave).toHaveBeenCalledWith("tkn", "doc1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("403 → 'subscription' (목록 refresh 안 함)", async () => {
    mockSave.mockRejectedValue(new HttpError(403));
    expect(await runSave("doc1")).toBe("subscription");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("410 → 'expired'", async () => {
    mockSave.mockRejectedValue(new HttpError(410));
    expect(await runSave("doc1")).toBe("expired");
  });

  it("409 → 'conflict'", async () => {
    mockSave.mockRejectedValue(new HttpError(409));
    expect(await runSave("doc1")).toBe("conflict");
  });

  it("기타 오류 → 'error'", async () => {
    mockSave.mockRejectedValue(new HttpError(500));
    expect(await runSave("doc1")).toBe("error");
  });

  it("토큰 없으면 'error' (저장 API 미호출)", async () => {
    mockToken.mockResolvedValue(null);
    expect(await runSave("doc1")).toBe("error");
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("documentId 없으면 'error'", async () => {
    expect(await runSave(undefined)).toBe("error");
    expect(mockSave).not.toHaveBeenCalled();
  });
});
