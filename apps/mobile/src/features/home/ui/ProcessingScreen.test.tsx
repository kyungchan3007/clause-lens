import * as React from "react";
import { ActivityIndicator, Text } from "react-native";
import renderer, { act } from "react-test-renderer";

// 스캔 그래픽은 애니메이션·AccessibilityInfo 의존 → 로직 테스트에선 목.
jest.mock("./DocScanGraphic", () => ({ DocScanGraphic: () => null }));

import { ProcessingScreen, type ProcessingState } from "./ProcessingScreen";

function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree.root;
}
const texts = (r: ReturnType<typeof render>) =>
  r.findAllByType(Text).map((t) => t.props.children);
const hasText = (r: ReturnType<typeof render>, s: string) =>
  r.findAllByType(Text).some((t) => t.props.children === s);

const base: ProcessingState = {
  phase: "analyzing",
  sentCount: 2,
  totalCount: 3,
  onCancel: jest.fn(),
  onRetry: jest.fn(),
  onViewResult: jest.fn(),
  onReset: jest.fn(),
};

describe("ProcessingScreen — 모드별 정직 표현", () => {
  it("업로드(uploading): '올리고 있어요' + 진짜 '취소' + '전송 완료' 주정보", () => {
    const r = render(<ProcessingScreen {...base} phase="uploading" sentCount={1} totalCount={3} />);
    expect(hasText(r, "계약서를 올리고 있어요")).toBe(true);
    expect(hasText(r, "취소")).toBe(true);
    expect(hasText(r, "나가기")).toBe(false);
    expect(hasText(r, "3페이지 중 1페이지 전송 완료")).toBe(true);
    // 업로드 안내(반대 문구) — "앱 닫아도 계속" 아님.
    expect(hasText(r, "전송이 끝날 때까지 앱을 열어 두세요.")).toBe(true);
  });

  it("분석(analyzing): '분석하고 있어요' + '나가기'(서버 계속) + 초록 안심 + '분석 완료' 주정보", () => {
    const r = render(<ProcessingScreen {...base} phase="analyzing" />);
    expect(hasText(r, "계약서를 분석하고 있어요")).toBe(true);
    expect(hasText(r, "나가기")).toBe(true);
    expect(hasText(r, "분석 취소")).toBe(false);
    expect(hasText(r, "서버에서 분석 중이에요. 앱을 닫아도 분석은 계속돼요.")).toBe(true);
    expect(hasText(r, "3페이지 중 2페이지 분석 완료")).toBe(true);
    // 큰 % 숫자(68%) 없음.
    expect(texts(r).some((t) => typeof t === "string" && t.includes("%"))).toBe(false);
  });

  it("준비 단계(requesting): 스피너 + '분석 요청 중…', 가짜 진행바/주정보 없음", () => {
    const r = render(<ProcessingScreen {...base} phase="requesting" sentCount={0} totalCount={3} />);
    expect(r.findAllByType(ActivityIndicator).length).toBe(1);
    expect(hasText(r, "분석 요청 중…")).toBe(true);
    expect(hasText(r, "3페이지 중 0페이지 분석 완료")).toBe(false);
  });

  it("done: '결과 보기' + '새 계약서 분석'(onReset)", () => {
    const r = render(<ProcessingScreen {...base} phase="done" sentCount={3} totalCount={3} />);
    expect(hasText(r, "분석이 끝났어요")).toBe(true);
    expect(hasText(r, "결과 보기")).toBe(true);
    expect(hasText(r, "새 계약서 분석")).toBe(true);
  });

  it("partial: 불완전성 명시 + '분석된 결과 보기'", () => {
    const r = render(<ProcessingScreen {...base} phase="partial" sentCount={2} totalCount={3} />);
    expect(hasText(r, "일부만 분석됐어요")).toBe(true);
    expect(hasText(r, "분석된 결과 보기")).toBe(true);
  });

  it("error: 메시지 + '다시 시도' + '페이지 확인'", () => {
    const r = render(
      <ProcessingScreen {...base} phase="error" message="분석 요청에 실패했어요" />,
    );
    expect(hasText(r, "분석에 문제가 생겼어요")).toBe(true);
    expect(hasText(r, "분석 요청에 실패했어요")).toBe(true);
    expect(hasText(r, "다시 시도")).toBe(true);
    expect(hasText(r, "페이지 확인")).toBe(true);
  });

  it("determinate 진행바에 progressbar role·값(now/max) 노출", () => {
    const r = render(<ProcessingScreen {...base} phase="analyzing" sentCount={2} totalCount={3} />);
    const bar = r.find((n) => n.props.accessibilityRole === "progressbar");
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 3, now: 2 });
  });

  it("indeterminate 구간엔 progressbar(가짜 now) 없음", () => {
    const r = render(<ProcessingScreen {...base} phase="requesting" sentCount={0} totalCount={3} />);
    expect(r.findAll((n) => n.props.accessibilityRole === "progressbar").length).toBe(0);
  });
});
