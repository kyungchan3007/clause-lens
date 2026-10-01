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

const bars = (r: ReturnType<typeof render>) =>
  r.findAll((n) => n.props.testID === "indeterminate-bar");

describe("ProcessingScreen — 모드별 정직 표현", () => {
  it("업로드(uploading, 다장): '올리고 있어요' + 진짜 '취소' + 흐르는 바 + 'N장 중 M장 전송'", () => {
    const r = render(<ProcessingScreen {...base} phase="uploading" sentCount={1} totalCount={3} />);
    expect(hasText(r, "계약서를 올리고 있어요")).toBe(true);
    expect(hasText(r, "취소")).toBe(true);
    expect(hasText(r, "나가기")).toBe(false);
    expect(bars(r).length).toBeGreaterThanOrEqual(1); // 흐르는 바(채움 아님)
    expect(hasText(r, "3장 중 1장 전송")).toBe(true);
    // 업로드 안내(반대 문구) — "앱 닫아도 계속" 아님.
    expect(hasText(r, "전송이 끝날 때까지 앱을 열어 두세요.")).toBe(true);
  });

  it("분석(analyzing, 다페이지): '나가기'(서버 계속) + 초록 안심 + 흐르는 바 + 'N페이지 중 M페이지 완료'", () => {
    const r = render(<ProcessingScreen {...base} phase="analyzing" sentCount={2} totalCount={3} />);
    expect(hasText(r, "계약서를 분석하고 있어요")).toBe(true);
    expect(hasText(r, "나가기")).toBe(true);
    expect(hasText(r, "분석 취소")).toBe(false);
    expect(hasText(r, "서버에서 분석 중이에요. 앱을 닫아도 분석은 계속돼요.")).toBe(true);
    expect(bars(r).length).toBeGreaterThanOrEqual(1);
    expect(hasText(r, "3페이지 중 2페이지 완료")).toBe(true);
    // 가짜 % 없음.
    expect(texts(r).some((t) => typeof t === "string" && t.includes("%"))).toBe(false);
  });

  it("분석(1페이지): 채움 바 아님 — 흐르는 바 + '분석 중…'(멈춘 0% 바 없음)", () => {
    const r = render(<ProcessingScreen {...base} phase="analyzing" sentCount={0} totalCount={1} />);
    expect(bars(r).length).toBeGreaterThanOrEqual(1);
    expect(hasText(r, "분석 중…")).toBe(true);
    expect(hasText(r, "1페이지 중 0페이지 완료")).toBe(false); // 1장은 완료 수 숨김
  });

  it("준비 단계(requesting): 흐르는 바 + '분석 요청 중…', 완료 수 없음", () => {
    const r = render(<ProcessingScreen {...base} phase="requesting" sentCount={0} totalCount={3} />);
    expect(bars(r).length).toBeGreaterThanOrEqual(1);
    expect(r.findAllByType(ActivityIndicator).length).toBe(0); // reduced-motion 아님 → 스피너 아님
    expect(hasText(r, "분석 요청 중…")).toBe(true);
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

  it("흐르는 바는 now 값을 주장하지 않음(가짜 진행률 없음)", () => {
    const r = render(<ProcessingScreen {...base} phase="analyzing" sentCount={2} totalCount={3} />);
    const bar = r.findAll((n) => n.props.testID === "indeterminate-bar")[0];
    expect(bar.props.accessibilityValue).toBeUndefined();
  });
});
