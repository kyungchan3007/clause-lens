import { ROLES, color, cssVarName, cssVars, semantic } from "@clause-lens/tokens";

describe("테마 변수(cssVars)", () => {
  it("light 변수 맵이 모든 semantic 역할을 누락 없이 포함", () => {
    const vars = cssVars("light");
    expect(Object.keys(vars)).toHaveLength(ROLES.length);
    for (const role of ROLES) {
      const name = cssVarName(role);
      expect(name.startsWith("--cl-")).toBe(true);
      expect(vars[name]).toBe(semantic.light[role]);
      expect(vars[name]).toBeTruthy();
    }
  });
  it("camelCase 역할 → kebab 변수명", () => {
    expect(cssVarName("primaryPressed")).toBe("--cl-primary-pressed");
    expect(cssVarName("warningText")).toBe("--cl-warning-text");
    expect(cssVarName("bg")).toBe("--cl-bg");
  });
  it("dark 변수도 생성되어 다크 스왑 구조가 준비됨", () => {
    const d = cssVars("dark");
    expect(Object.keys(d)).toHaveLength(ROLES.length);
    expect(d["--cl-bg"]).toBe(semantic.dark.bg);
  });
});

describe("색 리졸버(color)", () => {
  it("역할 → 현재 테마(light) hex", () => {
    expect(color("text")).toBe(semantic.light.text);
    expect(color("primary")).toBe(semantic.light.primary);
  });
  it("대비용 텍스트 역할이 점/강조 역할과 다르다", () => {
    expect(color("warningText")).toBe(semantic.light.warningText);
    expect(color("warningText")).not.toBe(color("warning"));
  });
  it("잘못된 역할은 조기 실패", () => {
    // @ts-expect-error 런타임 가드 확인
    expect(() => color("nope")).toThrow();
  });
  it("RN/SVG가 바로 쓸 수 있는 hex를 반환한다(var(--*) 아님)", () => {
    // color()는 preset의 className 경로와 달리 실제 색 문자열(hex)을 반환해야 한다.
    for (const role of ROLES) {
      const v = color(role);
      expect(v).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
      expect(v).not.toContain("var(");
    }
  });
});
