/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    // 공유 UI 패키지의 className 도 스캔
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [
    require("nativewind/preset"),
    // 디자인 토큰(Cobalt 3층) 주입
    require("@clause-lens/tokens/tailwind-preset"),
  ],
  theme: { extend: {} },
  plugins: [],
};
