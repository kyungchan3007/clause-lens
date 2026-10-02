# SDD — packages/config 프리셋화 (Nest tsconfig · Node jest)

> **관련 PRD:** 0054-config-presets/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"**완전 동일한 공통분만 올리고, 경로성·앱별 값은 각 앱에 남긴다.**" 승격 전 api·worker tsconfig와 3곳 jest.config를 정독·diff해 글자까지 같은 부분만 식별하고, 산출물이 틀어질 수 있는 경로성 값은 손대지 않는다.

- **tsconfig.nest.json (G1)** — api·worker tsconfig는 현재 **바이트 동일**. 그중 비경로 compilerOptions(module·target·moduleResolution·experimentalDecorators·emitDecoratorMetadata·esModuleInterop·resolveJsonModule·forceConsistentCasingInFileNames·declaration·sourceMap·incremental·types)만 nest 프리셋으로 올린다. nest는 기존처럼 `tsconfig.base.json`(strict·skipLibCheck)을 extends → 체인 `app → nest → base` 유지.
  - **경로성 값은 각 앱 유지(핵심):** `outDir`·`baseUrl`·`include`·`exclude`는 TS 규칙상 **정의된 tsconfig 기준 상대경로**로 해석된다. 프리셋(packages/config)에 올리면 `./dist`가 `packages/config/dist`로, `include:["src"]`가 `packages/config/src`로 틀어진다. 그래서 각 앱에 그대로 남긴다 → outDir=app/dist, src=app/src 불변.
- **jest-preset.js (G2)** — api·worker·contracts jest.config는 moduleFileExtensions·testRegex·transform(ts-jest+`<rootDir>/../tsconfig.spec.json`)·testEnvironment:node·resetMocks:true가 동일. 이들을 프리셋 객체로 올린다.
  - **rootDir="src"는 각 패키지 유지:** rootDir도 config 파일 기준 상대경로 → 각 jest.config에 남긴다.
  - **transform 토큰은 프리셋에 올려도 동치:** `<rootDir>/../tsconfig.spec.json`의 `<rootDir>`는 **소비처의 최종 rootDir(app/src)** 기준으로 Jest가 해석 → app/tsconfig.spec.json. 세 곳 모두 동일 구조라 프리셋 1벌로 재현된다.
- **소비 방식 (N4)** — `preset:` 필드 대신 `const preset = require("…/config/jest-preset"); module.exports = { ...preset, rootDir: "src" }`. `@clause-lens/config` package 의존성을 추가하지 않아 **lockfile·의존성 그래프 불변**(빌드 무영향). jest.config.js가 JS라 require spread가 가장 결정적.
- **범위 한정** — contracts **tsconfig**는 Nest 설정이 아니므로(데코레이터 없음·declaration:true·rootDir:./src) nest 프리셋 대상 제외. mobile jest는 RN(jest-expo)이라 손대지 않는다.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 비경로 옵션만 nest 프리셋 + 경로성은 앱 유지, jest는 require spread | 산출물 set-불변 보장, lockfile 무변경 | 앱에 outDir·baseUrl·rootDir 소량 잔존 | ✅ |
| B. outDir·baseUrl·include까지 프리셋으로 전부 올림 | 앱 tsconfig 더 얇음 | 상대경로가 packages/config 기준으로 틀어져 dist 경로·include 깨짐 | ❌ |
| C. jest를 `preset: "@clause-lens/config"` 필드로 소비 | 관용적 | 세 package에 `@clause-lens/config` devDep 추가 → lockfile·의존성 그래프 변경(빌드 불변 위험) | ❌ |
| D. contracts tsconfig도 nest 프리셋에 통합 | 더 많은 중복 제거 | contracts는 라이브러리 설정(declaration·rootDir·types:[])이라 Nest와 공통분 아님 → 억지 통일 | ❌ |

## 3. 검증 (Verification)
- **tsconfig 불변 증거:** 리팩토링 전 `tsc --showConfig`(api·worker, 그리고 tsconfig.spec.json 체인) 스냅샷을 뜨고, 리팩토링 후 재생성해 **sort 후 diff → set-동일** 확인. 유일한 차이는 키 출력 순서(merge 순서)뿐이며 compilerOptions 값 집합은 완전 동일.
- **jest 불변 증거:** `jest --showConfig`로 해석된 rootDir(app/src)·transform(ts-jest + `<rootDir>/../tsconfig.spec.json`)·resetMocks:true·testEnvironment:node가 원본과 일치함을 확인.
- **게이트:** `checks.sh`의 Build(contracts·db·infra) → 전 typecheck(mobile·api·worker·ui) → 전 유닛(contracts·infra·api·worker·mobile·ui) → expo-doctor → 기록 검사 ALL PASS. api·worker·contracts 테스트 수 before==after.
- 산출물이 바뀔 위험이 보이면 억지 통합을 멈추고 안전 범위만 적용 후 보고.
