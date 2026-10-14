import { Screen } from "@clause-lens/ui";

import { LoginScreen } from "../src/features/auth";

// 라우트는 얇게 — 화면만 렌더 (FSD: app 레이어)
export default function Page() {
  return (
    <Screen>
      <LoginScreen />
    </Screen>
  );
}
