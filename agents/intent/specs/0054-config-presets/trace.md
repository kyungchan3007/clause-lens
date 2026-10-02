# 0054 — 과정 기록 (trace)

## 판단
- **먼저 정독·diff부터.** api·worker tsconfig는 **바이트 동일**(include/exclude/outDir/baseUrl까지 전부 같음)이었고, api·worker·contracts jest.config는 moduleFileExtensions·rootDir·testRegex·transform·testEnvironment·resetMocks가 사실상 동일(차이는 주석과 transform 배열 줄바꿈뿐)이었다. → "완전 동일 공통분"만 프리셋으로 올리기로 확정.
- **경로성 값은 절대 프리셋에 올리지 않았다(불변의 핵심).** TS의 `outDir`·`baseUrl`·`include`·`exclude`와 jest의 `rootDir`는 **정의된 설정 파일 기준 상대경로**로 해석된다. 이것들을 packages/config로 올리면 `./dist`가 `packages/config/dist`로, `src`가 `packages/config/src`로 틀어져 **빌드 산출물 경로가 깨진다.** 그래서 nest 프리셋엔 비경로 compilerOptions만, jest 프리셋엔 rootDir을 뺀 공통만 올리고 경로성 값은 각 앱/패키지에 남겼다.
- **transform 토큰은 프리셋으로 올려도 동치임을 확인.** `<rootDir>/../tsconfig.spec.json`의 `<rootDir>`는 프리셋이 아니라 **소비처의 최종 rootDir(app/src)** 기준으로 Jest가 치환 → app/tsconfig.spec.json. 세 소비처가 동일 구조라 프리셋 1벌로 재현.
- **jest 소비는 `preset:` 필드 대신 `require()` spread.** `preset: "@clause-lens/config"`를 쓰려면 세 package에 `@clause-lens/config` devDep을 추가해야 하고 이는 lockfile·의존성 그래프를 바꿔 "빌드 불변"을 위협한다. jest.config.js가 JS이므로 상대경로 `require` + spread가 의존성 변경 0으로 가장 결정적.
- **범위 한정.** contracts **tsconfig**는 Nest 설정이 아님(데코레이터 없음·declaration:true·rootDir:./src·types:[]) → nest 프리셋 제외, jest만 공유. mobile jest(jest-expo)는 지시대로 무변경.

## 막힘 / 되돌림
- `tsc --showConfig` diff에서 `outDir`·`baseUrl`가 출력 **순서만** 달라져(원래 중간 → 이제 app 고유 옵션이라 뒤로 이동) raw diff는 비어있지 않았다. 그러나 이는 tsc가 키를 merge 순서로 출력하기 때문이고, `sort` 후 diff는 **완전 공집합**(set-동일) → 값·키 집합 불변 확인. 되돌릴 사안 아님.
- 억지 통합은 하지 않았다: contracts tsconfig·mobile jest는 공통분이 아니라 범위에서 제외.

## 검증 결과
- **tsconfig 불변 증거:** api·worker의 `tsc --showConfig`(tsconfig.json + tsconfig.spec.json 체인) 4종 스냅샷을 리팩토링 전/후로 떠서 `sort` 후 diff → **4종 모두 FULLY IDENTICAL(set-동일)**. 유일 차이는 키 출력 순서.
- **jest 불변 증거:** `jest --showConfig` 해석 결과 rootDir=app/src · transform=ts-jest(`<rootDir>/../tsconfig.spec.json`) · resetMocks=true · testEnvironment=node — 원본과 일치.
- `bash agents/harness/evals/checks.sh` **ALL PASS**(contracts/db/infra 빌드 → mobile·api·worker·ui typecheck → contracts·infra·api·worker·mobile·ui 유닛 → expo-doctor → lockfile·네이티브 단일버전 → 기록 검사).
- 테스트 수 before==after(코드 로직·테스트 파일 무변경, 설정만 프리셋화).
- 수치: 아래 "수치" 절(중복 제거 라인·파일수·테스트)은 커밋·보고와 동일.

### 수치
- 중복 제거: tsconfig 공통 옵션 12개를 2앱에서 1곳(nest)로 → api/worker tsconfig 각 20→9 LOC. jest 공통 6필드를 3곳에서 1곳(preset)로 → 각 jest.config 13~16→6 LOC.
- 변경/신규 파일: 신규 2(tsconfig.nest.json·jest-preset.js) + 수정 6(api·worker tsconfig, api·worker·contracts jest.config, config/package.json) + spec 3.
- 테스트: api 68(suite 12)·worker 41(suite 6)·contracts 15(suite 2) 유닛 **before==after**(무수정 통과).
