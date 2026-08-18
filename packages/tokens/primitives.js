// 3층 토큰 — 1층: primitive(원시 팔레트)
// 역할 없는 raw 값. 컴포넌트는 이걸 "직접" 쓰지 않는다 → semantic 을 쓴다.
// 리브랜딩 시에도 여기(팔레트)는 웬만하면 안 건드리고 semantic 매핑만 바꾼다.

const cobalt = {
  50: "#EFF4FF",
  100: "#DBE6FE",
  200: "#BFD3FD",
  300: "#93B4FD",
  400: "#5E8BFA",
  500: "#3B6FF6",
  600: "#2563EB", // 브랜드 프라이머리
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",
  950: "#172554",
};

const neutral = {
  0: "#FFFFFF",
  50: "#F8FAFC",
  100: "#F1F5F9",
  200: "#E2E8F0",
  300: "#CBD5E1",
  400: "#94A3B8",
  500: "#64748B",
  600: "#475569",
  700: "#334155",
  800: "#1E293B",
  900: "#0F172A",
};

const red = { 50: "#FEF2F2", 100: "#FEE2E2", 500: "#EF4444", 600: "#DC2626", 700: "#B91C1C" };
const amber = { 50: "#FFFBEB", 100: "#FEF3C7", 500: "#F59E0B", 600: "#D97706", 700: "#B45309" };
const green = { 50: "#F0FDF4", 100: "#DCFCE7", 500: "#22C55E", 600: "#16A34A", 700: "#15803D" };

module.exports = { cobalt, neutral, red, amber, green };
