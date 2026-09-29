const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    constructor(public status?: number) {
      super("api");
    }
  }
  const A: unknown = Object.assign(
    jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
    { APIError },
  );
  return { __esModule: true, default: A };
});

import Anthropic from "@anthropic-ai/sdk";

import { ClaudeClauseAnalyzer } from "./claude-clause-analyzer.adapter";
import { AnalysisPermanentError, AnalysisTransientError } from "../lib/errors";

const blocks = [{ id: "b0", text: "자동 갱신 조항" }];

// mock APIError(status) 생성(런타임은 mock 클래스, 실제 4~5인자 생성자 타입 우회).
function apiError(status: number): Error {
  const Ctor = (Anthropic as unknown as { APIError: new (s: number) => Error }).APIError;
  return new Ctor(status);
}

// resetMocks:true가 생성자 구현까지 리셋 → 매 테스트 전에 재설정.
beforeEach(() => {
  (Anthropic as unknown as jest.Mock).mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

function textResponse(text: string, stop = "end_turn") {
  return { stop_reason: stop, model: "claude-opus-5", content: [{ type: "text", text }] };
}

describe("ClaudeClauseAnalyzer", () => {
  it("유효 JSON → 조항 반환", async () => {
    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify({ clauses: [{ blockIds: ["b0"], type: "auto_renewal", title: "자동 연장", description: "d", riskLevel: "high" }] })),
    );
    const out = await new ClaudeClauseAnalyzer().analyze(blocks);
    expect(out.clauses).toHaveLength(1);
    expect(out.model).toBe("claude-opus-5");
  });

  it("코드펜스로 감싼 JSON도 파싱", async () => {
    mockCreate.mockResolvedValue(textResponse('```json\n{"clauses":[]}\n```'));
    const out = await new ClaudeClauseAnalyzer().analyze(blocks);
    expect(out.clauses).toEqual([]);
  });

  it("refusal → analysis_failed", async () => {
    mockCreate.mockResolvedValue(textResponse("", "refusal"));
    await expect(new ClaudeClauseAnalyzer().analyze(blocks)).rejects.toBeInstanceOf(AnalysisPermanentError);
  });

  it("출력 잘림(max_tokens) → analysis_failed", async () => {
    mockCreate.mockResolvedValue(textResponse('{"clauses":[', "max_tokens"));
    await expect(new ClaudeClauseAnalyzer().analyze(blocks)).rejects.toBeInstanceOf(AnalysisPermanentError);
  });

  it("JSON 아님 → analysis_failed", async () => {
    mockCreate.mockResolvedValue(textResponse("죄송합니다 분석할 수 없습니다"));
    await expect(new ClaudeClauseAnalyzer().analyze(blocks)).rejects.toBeInstanceOf(AnalysisPermanentError);
  });

  it("스키마 위반(blockIds 없음) → analysis_failed", async () => {
    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ clauses: [{ type: "auto_renewal", title: "t", description: "d", riskLevel: "high" }] })));
    await expect(new ClaudeClauseAnalyzer().analyze(blocks)).rejects.toBeInstanceOf(AnalysisPermanentError);
  });

  it("5xx → 일시 오류", async () => {
    mockCreate.mockRejectedValue(apiError(500));
    await expect(new ClaudeClauseAnalyzer().analyze(blocks)).rejects.toBeInstanceOf(AnalysisTransientError);
  });

  it("4xx(설정 오류) → 영구 오류", async () => {
    mockCreate.mockRejectedValue(apiError(400));
    await expect(new ClaudeClauseAnalyzer().analyze(blocks)).rejects.toBeInstanceOf(AnalysisPermanentError);
  });
});
