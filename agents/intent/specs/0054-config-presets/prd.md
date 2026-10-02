# PRD — packages/config 프리셋화 (Nest tsconfig · Node jest)

> **이슈:** #149 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02 · 작성: Claude

## 1. 문제 (Problem)
Nest 백엔드 두 앱과 Node 패키지들이 **빌드/테스트 설정을 손그림으로 복붙**해 drift 위험이 있다.

- `apps/api/tsconfig.json` · `apps/worker/tsconfig.json` — Nest 컴파일러 옵션(module·target·데코레이터·esModuleInterop 등)이 **글자까지 동일**하게 중복.
- `apps/api/jest.config.js` · `apps/worker/jest.config.js` · `packages/contracts/jest.config.js` — node + ts-jest + `resetMocks` jest 설정이 **사실상 동일**하게 중복.

한쪽만 고치면 서로 어긋나고, 새 Nest 앱/패키지 추가 시 또 복붙해야 한다.

## 2. 목표 (Goals)
- G1. `packages/config/tsconfig.nest.json`(api·worker 공통 Nest 옵션) 추가. 두 앱 tsconfig가 이를 extends하고 **경로성·앱별 값(outDir·baseUrl·include·exclude)만 각 앱에 남긴다.**
- G2. `packages/config/jest-preset.js`(node + ts-jest + resetMocks) 추가. api·worker·contracts jest.config.js가 공통 모듈 import(spread)으로 소비하고 **root="src"만 각 패키지에 남긴다.**
- G3. 중복 제거 후 **빌드 산출물·타입체크·테스트 실행·resetMocks 동작이 기존과 완전 불변.**

## 3. 목표가 아닌 것 (Non-goals)
- N1. 동작/산출물 변경 — 해석된 tsconfig(compilerOptions)·dist 경로·jest 해석 설정이 **리팩토링 전후 동일**해야 한다. 조금이라도 달라지면 되돌린다.
- N2. **mobile(apps/mobile)은 RN(jest-expo) 프리셋 — 절대 건드리지 않는다.**
- N3. contracts **tsconfig.json**은 Nest 설정이 아님(데코레이터 없음·declaration:true·rootDir) → nest 프리셋에 올리지 않는다(jest만 공유).
- N4. `@clause-lens/config`를 새 package 의존성으로 추가(의존성 그래프·lockfile 변경) — 상대경로 import로 회피.

## 4. 사용자 흐름 (User Flow)
사용자 영향 없음(빌드 설정 내부 리팩토링). 앱 동작·API·화면 모두 이전과 동일.

## 5. 성공 지표 (Success Metrics)
- `bash agents/harness/evals/checks.sh` ALL PASS(contracts·db·infra 빌드 → 전 typecheck → 전 유닛 → expo-doctor).
- `tsc --showConfig`로 뽑은 api·worker의 **해석된 compilerOptions가 리팩토링 전후 set-동일**(불변 증거).
- api·worker·contracts 기존 유닛 테스트 **무수정 통과**(before == after).

## 6. 제약 (Constraints)
Expo v57 고정, 서버가 진실의 기준. tsconfig의 `outDir`·`baseUrl`·`include`는 **정의된 파일 기준 상대경로**라 프리셋으로 올리면 경로가 틀어진다 → 각 앱에 유지. → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. jest 소비를 `preset:` 필드 대신 `require()` spread로 택함 — `@clause-lens/config` package 의존성/lockfile 변경 없이 결정적으로 해석되기 때문. 후속으로 package 의존성을 추가하면 `preset: require.resolve("@clause-lens/config/jest-preset")`로 전환 가능.

### Acceptance
- [x] `packages/config/tsconfig.nest.json` 추가(base extends + module·target·moduleResolution·데코레이터2종·esModuleInterop·resolveJsonModule·forceConsistentCasing·declaration:false·sourceMap·incremental·types:["node"]).
- [x] `apps/api/tsconfig.json`·`apps/worker/tsconfig.json`이 nest를 extends하고 outDir·baseUrl·include·exclude만 보유. 해석된 compilerOptions set-불변(`tsc --showConfig` 대조).
- [x] `packages/config/jest-preset.js` 추가(moduleFileExtensions·testRegex·transform(ts-jest+`<rootDir>/../tsconfig.spec.json`)·testEnvironment:node·resetMocks:true).
- [x] `apps/api`·`apps/worker`·`packages/contracts` jest.config.js가 프리셋 spread + rootDir:"src"만 보유. 해석된 jest 설정(rootDir·transform·resetMocks) 불변.
- [x] `packages/config/package.json` files에 신규 2파일 등록. mobile jest.config.js **무변경**.
- [x] `bash agents/harness/evals/checks.sh` ALL PASS, 기존 테스트 무수정 통과.
