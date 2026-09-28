jest.mock("react-native-sse", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
  })),
}));

import { HttpError, fetchStatus, requestAnalysis } from "./analysisApi";

const okJson = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;
const errStatus = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as Response;

const statusRes = {
  jobId: "job1",
  documentId: "doc1",
  status: "analyzing" as const,
  stateVersion: 2,
  job: { status: "processing" as const, totalPages: 2 },
  pages: [
    { pageId: "pg1", order: 0, status: "done" as const, revision: 1 },
    { pageId: "pg2", order: 1, status: "pending" as const, revision: 1 },
  ],
};

describe("analysisApi.requestAnalysis", () => {
  afterEach(() => jest.restoreAllMocks());

  it("정상: 응답 파싱 + Authorization 헤더", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue(okJson(statusRes));
    const r = await requestAnalysis("tkn", "doc1");
    expect(r.jobId).toBe("job1");
    expect(r.stateVersion).toBe(2);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tkn",
    );
    expect(init.method).toBe("POST");
  });

  it("HTTP 오류 → HttpError", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(errStatus(409));
    await expect(requestAnalysis("t", "doc1")).rejects.toBeInstanceOf(HttpError);
  });
});

describe("analysisApi.fetchStatus", () => {
  afterEach(() => jest.restoreAllMocks());

  it("정상: 상태 파싱", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(okJson(statusRes));
    const r = await fetchStatus("t", "doc1");
    expect(r.status).toBe("analyzing");
    expect(r.pages).toHaveLength(2);
  });

  it("알 수 없는 status → 파싱 실패(throw)", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(okJson({ ...statusRes, status: "weird" }));
    await expect(fetchStatus("t", "doc1")).rejects.toBeTruthy();
  });
});
