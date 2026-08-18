# 공유 저널 (Shared Journal) — append-only

> 두 AI(Claude, Codex)의 작업 로그. **최신 항목을 맨 위에 추가**합니다.
> 남의 항목은 수정·삭제하지 않습니다. 형식은 [observability.md](harness/observability.md) 참고.
>
> ```md
> ## YYYY-MM-DD HH:MM · <Claude|Codex> · #TASK-xxx
> - **무엇**: …
> - **왜**: …
> - **파일**: …
> - **게이트**: PASS/FAIL
> - **다음/주의**: …
> ```

---

## 2026-08-18 · Claude · #TASK-F3N 아이콘 네이티브 리빌드 완료
- **무엇**: `react-native-svg` 포함 iOS 네이티브 리빌드 → lucide `<Icon>` 실제 렌더 확인. Camera/Image/Trash2/Plus 아이콘이 토큰 색(코발트/빨강/초록)으로 정상 렌더.
- **왜**: F3에서 미룬 svg 네이티브 검증(Icon 런타임).
- **파일**: `apps/mobile/ios/Podfile.lock`(RNSVG pod 추가), 문서.
- **게이트**: pod install(RNSVG 자동링크·codegen) → xcodebuild 성공(build-time 122s, 0 errors) → 시뮬 실행 → Metro 번들(3539 모듈) → 아이콘 렌더 스크린샷.
- **다음/주의**: (1) `pod install`이 Pods 프로젝트 재생성 → pod 빌드 캐시 무효화로 전체 pod 재컴파일(첫 빌드급). (2) 이 환경은 빌드 시 machine 과부하(load 48)로 wall-clock 매우 김. (3) background 감시자의 `read -t` 지연이 detached 컨텍스트에선 안 먹혀 조기 종료할 수 있음 → 완료는 로그 마커/clang 프로세스로 판정. (4) 이제 앱에서 `import { Icon, Button } from "@clause-lens/ui"` 풀 사용 가능(TASK-001 아이콘 포함 구현 가능).

## 2026-08-18 · Claude · #TASK-F3 공유 UI 패키지 + NativeWind 배선 완료
- **무엇**: `packages/ui`(Button 3 variant + lucide `<Icon>` 래퍼) + 앱에 NativeWind 배선(babel·metro·tailwind.config·global.css·nativewind-env). 앱이 tokens/ui를 workspace dep로 소비. 시뮬레이터에서 **NativeWind+토큰+Button 렌더 확인**(Cobalt #2563EB), 기존 Skia 화면도 새 babel에서 정상.
- **왜**: 도메인이 소비할 디자인 시스템 컴포넌트 계층(마지막 기반).
- **핵심 함정/해결**:
  1. Tailwind는 **v3.4 핀**(NativeWind 4.x는 v4 비호환).
  2. `react-native-svg` **중복**(15.15.4/15.15.5) → `pnpm-workspace.yaml overrides`로 15.15.4 고정(pnpm11은 package.json `pnpm` 필드 무시).
  3. `import "*.css"` tsc 에러 → `declare module "*.css"` 추가.
  4. `packages/ui`(.tsx) peer(react/react-native) 미해결 → **type 전용 devDependencies 추가**(앱과 동일 버전).
  5. **`react-native-css-interop`(nativewind 전이 의존성)가 Metro 미해결** → **앱 직접 dep로 추가**(0.2.6). pnpm hoisted가 peer 변형 2개라 hoist 안 함.
- **파일**: `packages/ui/**`, `apps/mobile/{babel.config.js,metro.config.js,tailwind.config.js,global.css,nativewind-env.d.ts,app/_layout.tsx,package.json}`, `packages/tokens/tailwind-preset.js`(semantic 색 보완: background/surface/foreground/border), `package.json`·`pnpm-workspace.yaml`(overrides)
- **게이트**: 앱 typecheck + ui typecheck(앱 경유) + expo-doctor 21/21 + NativeWind 렌더 스크린샷 PASS.
- **다음/주의**: (1) **NativeWind는 네이티브 리빌드 불필요**(JS/Metro). (2) **lucide `<Icon>`은 `react-native-svg`(네이티브) 필요 → 아직 리빌드 안 함 → 실제 아이콘 렌더는 TASK-F3N**. Button 검증 시 barrel import는 svg 로드하므로 직접 import + `import type`로 회피. (3) 다크모드 적용 전략·커스텀 폰트는 추후. 브랜치 `task/F3-ui`.

## 2026-08-18 · Claude · #TASK-F2 디자인 토큰 패키지 완료
- **무엇**: `packages/tokens` 생성. 3층 토큰(primitives→semantic→preset), Cobalt #2563EB 프라이머리, light/dark semantic, 타이포·radius, NativeWind tailwind-preset. 값=CJS(.js), 타입=index.d.ts.
- **왜**: 디자인 시스템의 단일 토큰 소스. F3(공유 UI)와 앱이 소비.
- **설계**: CJS 채택 이유 = tailwind preset이 JS require 필수 + 빌드 단계 없이 tailwind/앱/Skia 모두 소비. 컴포넌트는 primitive 직접 사용 금지(semantic만).
- **파일**: `packages/tokens/{primitives,semantic,typography,index,tailwind-preset}.js`, `index.d.ts`, `package.json`(exports: `.`, `./tailwind-preset`), `tsconfig.json`, `README.md`
- **게이트**: 토큰 값 node 검증(cobalt600=#2563EB 등) + preset 유효 + tokens tsconfig 타입 클린 + 앱 게이트 ALL PASS(무변경).
- **다음/주의**: 앱이 아직 tokens를 dep로 선언 안 함 → 앱에서 import는 F3에서(`workspace:*` dep + tailwind.config presets 배선). 다크모드 적용 전략(`dark:` variant vs CSS 변수)·커스텀 폰트 로딩도 F3.

## 2026-08-18 · Claude · #TASK-F1N 네이티브 리빌드 검증 완료 (iOS)
- **무엇**: 모노레포 이동 후 iOS 네이티브 빌드·실행 end-to-end 검증. `pod install`(UTF-8 로케일 필요) → 100 pods, xcodebuild 성공(0 errors, 2119 warnings=jsi umbrella 정상 노이즈) → 시뮬레이터(iPhone 17 Pro) 실행 → Metro 번들(1263 모듈) → **Skia 셰이더 렌더링 확인**.
- **왜**: 파일 이동이 네이티브 빌드/경로 해석을 깨지 않았는지 실증(F1의 분리 검증).
- **파일**: `apps/mobile/ios/Podfile.lock`(pod install 재생성), 문서 상태 갱신.
- **게이트**: 네이티브 빌드 SUCCEEDED + 앱 실제 실행·렌더 확인.
- **다음/주의**: (1) `pod install`은 **`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`** 필요(비대화형 셸 인코딩 에러 회피). (2) pod·네이티브 컴파일 모두 **호이스팅 루트 `node_modules/.pnpm`에서 정상 해석** — 모노레포 네이티브 리스크 해소. (3) 이 환경은 빌드를 ~10% CPU로 스로틀 → 첫 빌드 wall-clock 매우 김(build-time 664s). (4) **Android(Gradle)는 미검증** — 필요 시 별도. (5) Metro 개발서버 백그라운드 실행 중.

## 2026-08-18 · Claude · #TASK-F1 모노레포 재구성 완료
- **무엇**: Expo 앱을 `apps/mobile`로 이동, pnpm workspace+Turborepo 모노레포 착지. `packages/config`(공유 tsconfig base) 생성, `apps/{api,worker}`·`packages/{contracts,tokens,ui}`는 자리(.gitkeep)만. `.npmrc node-linker=hoisted`, `apps/mobile/metro.config.js`(watchFolders+nodeModulesPaths), 루트 `package.json`(turbo 스크립트)·`turbo.json` 추가. `checks.sh`를 `--filter @clause-lens/mobile` 타겟으로 갱신.
- **왜**: 백엔드+프론트 계약 공유 대비 발판(TASK-F2·F3의 선행).
- **파일**: `apps/mobile/**`(이동), `package.json`(루트 신규), `turbo.json`, `.npmrc`, `pnpm-workspace.yaml`, `packages/config/*`, `apps/mobile/{metro.config.js,tsconfig.json,package.json}`, `agents/harness/evals/checks.sh`
- **게이트**: ✅ ALL PASS — Typecheck(mobile) + expo-doctor 21/21. 추가로 Metro iOS 번들(1721 모듈, 루트 node_modules 해석) 성공.
- **다음/주의**: (1) `ios/`·`android/`는 gitignore된 생성물이라 `git mv` 아닌 `mv`로 이동, 미추적. (2) tsconfig 함정: `expo/tsconfig.base`는 `apps/mobile/node_modules`에만 있어 `packages/config`에서 상속 불가 → **app이 expo base를 직접 상속**(배열 extends), config는 범용 옵션만. (3) **네이티브 리빌드(pod/gradle)는 미검증** → TASK-F1N으로 분리(B). 커밋 안 함(사용자 승인 대기). 브랜치 `task/F1-monorepo`.

## 2026-08-18 · Claude · 결정: 모노레포 구조·오케스트레이터 확정
- **무엇**: 백엔드(NestJS)+Worker가 같은 레포에 들어옴이 확정 → 모노레포 구조·오케스트레이터 확정. `apps/{mobile,api,worker}` + `packages/{contracts,tokens,ui,config}`, 오케스트레이터 = **Turborepo+pnpm**.
- **왜**: 모노레포 근거는 **백엔드+프론트 계약 공유 하나**(다중 앱 아님 — 제품 앱은 mobile 하나). Nx는 후보였으나 배포 단위 3개+패키지 소수 규모엔 과함 → 이 규모의 현업 표준은 Turborepo. NestJS는 자체 CLI로 Turborepo에서 문제없음. 경계 강제는 contracts 순수 유지 + eslint-plugin-boundaries.
- **계약**: `packages/contracts` = zod 스키마(서버 검증 + 앱 타입 단일 소스). zod vs OpenAPI 코드젠은 서버 착수 시 확정.
- **정정**: 앞서 채팅에서 Nx를 "다중 앱" 근거로 권했으나 그건 오류(제품 앱 하나). 사용자가 균열 지적 → Turborepo로 정정(원래 자리).
- **파일**: `agents/context/architecture.md`(§디자인 시스템 & 모노레포 확장), `agents/orchestration/TASKS.md`(F1~F3 구조 반영)
- **게이트**: 문서만.
- **다음/주의**: F1은 구조·자리만 + mobile 실제 이동. api/worker/contracts는 서버 착수 시. "app"은 제품 기준 하나임을 혼동 말 것.

## 2026-08-18 · Claude · 결정: 디자인 시스템 스택 + 모노레포
- **무엇**: 프론트 디자인 시스템/모노레포 스택 확정. NativeWind + react-native-reusables + lucide-react-native, pnpm+Turborepo 모노레포, 3층 토큰(Cobalt #2563EB).
- **왜**: 사용자 기준 = "요즘 현업 최다 + 유용". NativeWind가 신규 Expo 앱 사실상 기본값(문서·커뮤니티 최다=마찰 최소), reusables가 그 위에 얹혀 컴포넌트 소유, lucide 모던 아이콘. 이 셋이 서로 붙게 설계됨.
- **검토한 대안**: Tamagui(무거움→기각), Restyle/unistyles(타입이지만 reusables 비호환, 사용자 타입 선호 있었으나 "현업 최다" 우선순위로 NativeWind 채택). Style Dictionary/Figma 자동화·유니버설=멀티플랫폼 트리거 오면.
- **파일**: `agents/context/architecture.md`(§디자인 시스템 & 모노레포), `agents/orchestration/TASKS.md`(기반 Phase 0: TASK-F1~F3, TASK-001 depends=TASK-F3)
- **게이트**: 문서만.
- **다음/주의**: TASK-001 착수 전 TASK-F1→F2→F3 선행. Metro 모노레포 설정(watchFolders·심볼릭 링크)은 Expo 모노레포 대표 함정이니 TASK-F1에서 반드시 처리. 스타일은 클래스 문자열이지만 토큰 config는 타입 + IntelliSense 자동완성으로 보완.

## 2026-08-17 22:55 · Codex · #OPS-ISSUE-STYLE-RULES
- **무엇**: GitHub 이슈 초안 정리 지침에 명사형 종결 문체 규칙과 `커밋메시지(한글)` 동반 출력 규칙을 추가.
- **왜**: 이슈 초안과 커밋 메시지 문체를 더 일관되게 유지하고, 사용자가 바로 복붙해 쓸 수 있는 형태로 맞추기 위해.
- **파일**: `agents/harness/github-issue-templates.md`
- **게이트**: ✅ PASS (`bash agents/harness/evals/checks.sh`)
- **다음/주의**: feature 요청이라도 실제 diff가 fix/refactor 성격이면 그 점을 한 줄로 명시하되, 본문 문체는 계속 명사형으로 유지.

## 2026-08-17 22:48 · Codex · #OPS-ISSUE-DRAFT-RULES
- **무엇**: 사용자가 `feat/refactor/fix/style/docs/deploy 템플릿으로 정리해줘`라고 요청했을 때, 변경된 코드 기준으로 GitHub 이슈 초안을 작성하는 운영 지침서를 추가.
- **왜**: 혼자 작업할 때 diff를 다시 읽어 이슈 문장을 수동 작성하는 비용을 줄이고, 템플릿 출력 형식을 일관되게 유지하기 위해.
- **파일**: `agents/harness/github-issue-templates.md`, `agents/harness/README.md`, `AGENTS.md`
- **게이트**: ✅ PASS (`bash agents/harness/evals/checks.sh`)
- **다음/주의**: 템플릿 요청이 실제 diff 성격과 달라도 사용자가 지정한 종류를 우선하되, 어긋남은 한 줄로 명시한다.

## 2026-08-17 22:40 · Codex · #OPS-ISSUE-TEMPLATES
- **무엇**: GitHub 저장소용 이슈 템플릿 6종(`feature`, `refactor`, `fix`, `style`, `docs`, `deploy`)과 기본 설정 파일을 추가.
- **왜**: 혼자 작업하더라도 이슈 입력 형식을 고정해 PR/작업 단위를 분류하고 기록 품질을 올리기 위해.
- **파일**: `.github/ISSUE_TEMPLATE/config.yml`, `.github/ISSUE_TEMPLATE/*.yml`
- **게이트**: ✅ PASS (`bash agents/harness/evals/checks.sh`)
- **다음/주의**: 라벨은 GitHub 저장소에 미리 만들어두면 템플릿의 `labels` 값이 바로 적용된다.

## 2026-08-17 · Claude · 결정: BFF 미채택(트리거 재검토)
- **무엇**: 앱↔NestJS 사이 별도 BFF 계층을 두지 않기로 결정. 재검토 트리거 + 3층 캐싱 정책을 architecture.md에 기록, SDD 템플릿에 체크포인트 추가.
- **왜**: 요청 수·비용 걱정은 BFF로 안 풀림(요청은 기기에서 나감, BFF는 원본 부하만 감소). 앱 복귀는 메모리 캐시(TanStack Query)로 공짜, 콜드스타트는 persist, 서버부하는 NestJS 내부 캐시로. NestJS가 이미 BFF 역할. 데이터가 사적·개인별·미리계산이라 서버 공유 캐시 효율도 낮음.
- **정책**: 기본값 "안 만듦". 새 기능/API 연동 시 트리거 3개(다른 클라이언트/다중 서비스 조합/계약 분기) 검토, YES라도 NestJS 엔드포인트 우선, 그래도 안 되면 별도 서비스.
- **파일**: `agents/context/architecture.md`(§BFF는 두지 않는다), `agents/intent/templates/sdd.md`(§4 BFF 트리거 체크)
- **게이트**: 문서만 변경.
- **다음/주의**: 클라 데이터 계층은 TanStack Query(서버 캐시·staleTime·persist) + Zustand(Draft)로 확정 방향. entitlement는 서버 최종 기준 유지.

---

## 2026-08-17 · Claude · 도메인·기능 가이드 통합
- **무엇**: 사용자 제작 가이드 16개를 아키텍처에 통합. 도메인 6 + domain-map → `context/`(flat), 기능 6 → `intent/features/`. INSTALL.md·중복 README 2개는 폐기(알맹이만 흡수).
- **왜**: 추상 아키텍처와 작업 스펙 사이의 "도메인 모델 + 기능 정의" 중간층 공백을 채움.
- **배치 결정(논쟁으로 확정)**: 계층 = 동사 하나. **feature=정의한다→Intent**(Harness는 기능-불문 기계장치라 per-feature 파일 불가), **domain=안다→Context**. Intent가 배제하는 건 엔지니어링 how이지 행동 how가 아님 → PRD 템플릿 문구 정정.
- **파일**: `AGENTS.md`, `agents/README.md`(동사 판별표+배치원칙), `agents/context/*`(도메인 6+domain-map, README·architecture 링크), `agents/intent/README.md`(features 인덱스), `agents/intent/features/*`(6), `agents/intent/templates/prd.md`, `agents/intent/specs/0001`(feature 참조), `agents/harness/loop.md`(충돌 우선순위+완료조건), `agents/harness/guardrails.md`(민감정보 로그 금지), `agents/orchestration/TASKS.md`(스펙 공백→feature 연결, TASK-007 추가)
- **게이트**: 문서만 변경, 앱 코드 무변경 → typecheck 영향 없음(직전 PASS 유지).
- **다음/주의**: context는 flat 유지(도메인 서브디렉터리 만들지 말 것, domain-map이 유일 인덱스). 기능 구현 착수 전 `intent/features/<기능>` → `context/domain-map` → 관련 도메인 문서 순서로 읽을 것.

---

## 2026-08-17 · Claude · 게이트 최초 PASS
- **무엇**: 완료 게이트(`checks.sh`)를 최초로 초록으로 만듦. Typecheck + expo-doctor 모두 PASS.
- **왜**: 게이트가 완료 판정 기준이므로 실제로 통과 가능한 상태여야 함.
- **파일**: `package.json`/lock(@types/react 추가, expo-constants·expo-router 패치 정렬), `components/iridescence.tsx`(셰이더 null 타입 버그 수정), `agents/harness/evals/checks.sh`(expo-doctor는 `pnpm dlx`로 호출)
- **게이트**: ✅ PASS (Typecheck 21/21, expo-doctor 21/21)
- **다음/주의**: `Skia.RuntimeEffect.Make`는 `SkRuntimeEffect | null` 반환 → 이 tsc(6.0.3)는 module-const narrowing이 클로저로 전파 안 됨. 명시적 타입 바인딩(`const source: SkRuntimeEffect = compiledShader`)으로 처리. 유사 셰이더 코드에서 동일 패턴 사용할 것. `pnpm-workspace.yaml`에 `minimumReleaseAgeExclude` 항목이 자동 추가됨(expo install 부작용).

---

## 2026-08-17 · Claude · 아키텍처 스캐폴드
- **무엇**: 에이전틱 엔지니어링 아키텍처(Intent/Context/Harness/Orchestration + Verification 직교축)를 `AGENTS.md` + `agents/` 트리로 구축.
- **왜**: Claude와 Codex 두 AI가 동일한 규칙·단일 진실 소스로 협업하기 위함.
- **파일**: `AGENTS.md`, `agents/**` (README·intent·context·harness·orchestration·evals/checks.sh·JOURNAL)
- **게이트**: 문서 스캐폴드라 앱 코드 변경 없음. `checks.sh`는 실행 가능 상태로 제공.
- **다음/주의**: 두 AI 모두 작업 시작 전 `AGENTS.md → agents/README.md`를 읽고, `TASKS.md`에서 태스크를 CLAIM할 것. 첫 실제 작업 후보는 TASK-001(스펙 0001 존재).
