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

# 0) 공유 계약 빌드 (contracts) — api·mobile 타입 해석의 선행(dist 필요)
run "Build (contracts)" pnpm --filter @clause-lens/contracts build

# 0b) 공유 DB 함수 빌드 (db/analysis) — api·worker가 @clause-lens/db/analysis 를 해석하려면 선행 빌드 필요
run "Build (db)" pnpm --filter @clause-lens/db build

# 1) 타입 체크 (모바일 앱)
run "Typecheck (mobile)" pnpm --filter @clause-lens/mobile exec tsc --noEmit

# 1b) 타입 체크 (백엔드 API)
run "Typecheck (api)" pnpm --filter @clause-lens/api exec tsc --noEmit

# 1b') 타입 체크 (OCR Worker)
run "Typecheck (worker)" pnpm --filter @clause-lens/worker exec tsc --noEmit

# 1b'') 타입 체크 (공유 UI) — 앱 import에 안 걸리는 미사용 신규 컴포넌트까지 검사(테스트 제외)
run "Typecheck (ui)" pnpm --filter @clause-lens/ui typecheck

# 1c) Prisma 스키마 검증 (DB 연결 안 함 — env() 해석용 더미 URL만 주입)
run "Prisma schema validate" bash -c 'DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" pnpm --filter @clause-lens/db exec prisma validate'

# 2) Expo 환경 점검 (apps/mobile에서 expo-doctor를 dlx로 실행)
#    expo-doctor는 네이티브 모듈 중복(duplicate)도 함께 검사한다.
run "Expo Doctor" bash -c 'cd apps/mobile && pnpm dlx expo-doctor'

# 3) 다른 패키지 매니저 lockfile 금지 (pnpm만 사용) — 있으면 설치 혼용·의존성 불일치 유발.
#    node_modules만 제외하고 레포 전체를 검색(서브패키지의 nested lockfile까지 잡음).
run "No npm/yarn lockfiles" bash -c '! find . -type d -name node_modules -prune -o -type f \( -name package-lock.json -o -name yarn.lock \) -print | grep -q .'

# 4) 네이티브 모듈 단일 버전 — 워크스페이스 전체 resolved 버전 검사(중복 시 네이티브 빌드 실패).
run "Native modules single version" node agents/harness/evals/check-native-singletons.mjs

# 5) 유닛 테스트 (백엔드 로직·앱 상태/저장/API). e2e 시나리오는 apps/mobile/.maestro 참조.
run "Unit tests (contracts)" pnpm --filter @clause-lens/contracts test
run "Unit tests (api)" pnpm --filter @clause-lens/api test
run "Unit tests (worker)" pnpm --filter @clause-lens/worker test
run "Unit tests (mobile)" pnpm --filter @clause-lens/mobile test
# 공유 UI(packages/ui) 단위 — 테스트는 ui에 소유, 실행은 mobile jest-expo 재사용(jest.ui.config.js)
run "Unit tests (ui)" pnpm --filter @clause-lens/mobile exec jest --config jest.ui.config.js

# 6) 이슈·체크박스 기록 (하네스 이식 1/4, #82) — 파서 단위 테스트 + 오프라인 판정
#    (0023+ spec 이슈번호 필수 · done 태스크 spec의 사유 없는 미체크 차단)
#    브랜치↔이슈 연결·체크박스 동기화는 네트워크 필요 → pnpm issue-link / issue-sync (게이트 밖, PR 전후).
run "Harness unit tests" node --test agents/harness/lib/records.test.mjs agents/harness/lib/records.folder.test.mjs agents/harness/evals/issue-sync.test.mjs agents/harness/commit/message.test.mjs agents/harness/usage/usage.test.mjs agents/harness/hooks/trace.test.mjs agents/harness/metrics/lib.test.mjs agents/harness/hooks/lib/recall.test.mjs
run "Issue·checkbox records" node agents/harness/evals/check-issue-records.mjs
# 폴더형 spec 기록(하네스 이식 3/4, #84): 0025+ 폴더 필수·prd/sdd/trace·done 미체크 차단
run "Task records (folder)" node agents/harness/evals/check-task-records.mjs

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
