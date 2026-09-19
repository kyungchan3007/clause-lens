import { ProfileScreen } from "../src/features/profile";

// 라우트는 얇게 — 화면만 렌더 (헤더/뒤로가기는 _layout의 Stack.Screen이 제공)
export default function Page() {
  return <ProfileScreen />;
}
