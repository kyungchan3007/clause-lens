#!/usr/bin/env bash
# 완료 게이트 — 두 AI(Claude, Codex) 공통.
# 완료 선언 전 반드시 PASS 해야 함. 하나라도 실패하면 non-zero 종료.
# 사용법:  bash agents/harness/evals/checks.sh
set -uo pipefail

# 저장소 루트로 이동 (스크립트 위치 기준)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

FAIL=0
run() {
  local name="$1"; shift
  echo ""
  echo "▶ $name"
  echo "  \$ $*"
  if "$@"; then
    echo "  ✅ PASS — $name"
  else
    echo "  ❌ FAIL — $name"
    FAIL=1
  fi
}

echo "════════════════════════════════════════"
echo " ClauseLens 완료 게이트"
echo " root: $ROOT"
echo "════════════════════════════════════════"

# 1) 타입 체크 (모바일 앱)
run "Typecheck (mobile)" pnpm --filter @clause-lens/mobile exec tsc --noEmit

# 2) Expo 환경 점검 (apps/mobile에서 expo-doctor를 dlx로 실행)
run "Expo Doctor" bash -c 'cd apps/mobile && pnpm dlx expo-doctor'

# ── 새 검사는 위 형식으로 여기에 한 줄씩 추가 ──
# run "Lint" pnpm exec eslint .
# run "Unit tests" pnpm test

echo ""
echo "════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo " 결과: ✅ ALL PASS — 완료 선언 가능"
else
  echo " 결과: ❌ FAIL — 완료 선언 금지. 위 실패 항목을 고치세요."
fi
echo "════════════════════════════════════════"
exit "$FAIL"
