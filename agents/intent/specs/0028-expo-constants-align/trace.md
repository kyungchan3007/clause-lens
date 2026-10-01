# 0028 — 과정 기록 (trace)

## 판단
- **별도 이슈로 분리**: TASK-005(#90) 백엔드 작업 중 Expo Doctor FAIL 발견. 원인은 모바일 의존성 드리프트로 백엔드와 무관 → `1이슈=1브랜치=1성격`에 따라 #92로 분리(엔타이틀먼트 PR #91은 그대로).
- **`expo install` 선택**: SDK가 고정한 버전으로 맞추는 공식 경로. 수기 수정보다 안전.

## 막힘 / 되돌림
- **lockfile 재해석 → 유닛 테스트 깨짐**: `expo install`이 lockfile을 재해석하며 jest peer에 `@types/node`가 추가돼 node_modules가 어긋나 `ts-jest` 모듈 미발견으로 contracts·api·worker 테스트 실패. 루트 `pnpm install`로 node_modules를 lockfile에 동기화해 해결.
- **브랜치 전환 잔존물**: 브랜치 90의 `0027/trace.auto.jsonl`(gitignore 대상 자동 추적)이 브랜치 92에 빈 폴더로 남아 `check-task-records`가 "0027 prd/sdd/trace 없음"으로 오탐. 비추적 잔존물 삭제로 해결(브랜치 90 추적 파일엔 무영향).
- **하네스 [보완]**: ① `trace.auto.jsonl`을 spec 폴더에 두면 브랜치 전환 시 타 브랜치 게이트를 오탐 → 위치 변경/비추적 폴더 무시 필요. ② `expo install`의 lockfile peer 재해석이 node_modules를 깨므로 게이트에 `pnpm install` 동기화 단계 고려.
- **되돌림 없음**.
