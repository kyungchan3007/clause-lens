# SDD — jest-expo 버전 정렬

- **관련 PRD**: 0075-jest-expo-version/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)
`apps/mobile/package.json`의 devDependency `jest-expo`를 `~57.0.5` → `~57.0.6`으로 올리고, `pnpm install`로 lockfile을 갱신해 설치 버전이 57.0.6이 되게 한다. 그 뒤 expo-doctor·checks.sh로 검증.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. jest-expo를 `~57.0.6`으로 정렬 | 근본 해결·SDK 기대와 일치 | lock 갱신 필요 | ✅ |
| B. `expo.install.exclude`에 jest-expo 추가 | 빠름 | 불일치를 숨길 뿐·테스트 러너 drift 방치 | ❌ |
| C. 그대로 두기 | 작업 없음 | 게이트 계속 FAIL | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 파일/모듈: `apps/mobile/package.json`(jest-expo 범위), `pnpm-lock.yaml`
- 새 의존성: 없음(기존 패키지 패치 정렬)
- 상태: 테스트 러너 버전만, 런타임 동작 영향 없음

## 4. 데이터 / 계약 (Contracts)
API/계약 변경 없음. 테스트 실행 도구 버전만 조정.

## 5. 위험과 완화 (Risks)
- R1. jest-expo 패치 상승으로 테스트 거동 변화 → 완화: `checks.sh`의 단위 테스트 전부 재실행해 녹색 확인.
- R2. lock에 다른 전이 의존성 변동 → 완화: diff 확인, jest-expo 관련 외 불필요 변경 없게 단건 설치.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 커밋(package.json + lock). 문제 시 revert.

## 7. 검증 (Verification)
- `cd apps/mobile && pnpm dlx expo-doctor` 버전 검사 통과.
- `bash agents/harness/evals/checks.sh` ALL PASS.
