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

## 2026-09-22 · Claude · #55 Acceptance 체크박스 완료 반영 규칙 (지침 갱신)
- **무엇**: Acceptance 체크박스를 만들고 방치하던 문제 → `loop.md`에 RECORD 단계 갱신 규칙 + `§Acceptance 갱신` 섹션 + self-check. 기존 spec 0013/0014/0015 완료 항목 체크, 닫힌 이슈 #49/#51 체크 정리.
- **왜**: 사용자 지적 — 완료 후에도 미체크라 done/후속 구분 불가로 혼란. "만들면 닫는다"를 지침으로 박음.
- **파일**: `agents/harness/loop.md`(8.RECORD·§Acceptance 갱신·self-check), spec `0016`, specs 0013/0014/0015 체크, JOURNAL 포맷 흠(빈 줄) 수정.
- **게이트**: ✅ ALL PASS(문서 전용).
- **다음/주의**: 다음 = S9~S15 시나리오 백필(트리거 규칙 develop 반영 완료).

## 2026-09-22 · Claude · #53 e2e 시나리오 트리거 규칙 (지침 갱신)
- **무엇**: `loop.md §테스트 필수`에 **시나리오 생명주기 = 기능 생명주기** 트리거 규칙(추가/변경/삭제/백엔드 표) + self-check 항목 + memory 갱신.
- **왜**: "매 태스크 e2e"가 뭉툭 → 기능 변화와 시나리오 동기화 기준을 명문화(placeholder/썩는 시나리오 구조적 방지).
- **결정(A/B, 사용자 "정석?")**: 규칙+백필 한 PR(A) 대신 **규칙 전용 PR 먼저(B)** — 관심사 분리·DEFINE→BUILD·독립 revert·#45 선례. spec 0015에 근거 기록.
- **파일**: `agents/harness/loop.md`(§테스트 필수 트리거 표·self-check), memory `testing-and-shared-ui-rules`, spec `0015`.
- **게이트**: ✅ ALL PASS(문서 전용).
- **다음/주의**: 이 규칙 머지 후 **그 아래에서 S9~S15 시나리오 백필**(후속 태스크).

## 2026-09-22 · Claude · #51 카메라/사진 권한 거부 안내 (S17 공백 수정)
- **무엇**: 권한 거부 시 `return null`로 조용히 무동작하던 공백 수정. `lib/permission.ts` `notifyPermissionDenied` 추가 → `useImagePicker`가 거부 시 호출(설정 이동 안내).
- **왜**: e2e 시나리오(S17)를 쓰려다 드러난 공백 — 실제 동작 먼저 구현. iOS는 권한 최초 1회만 물으므로 거부 후 설정 이동이 유일 경로인데 안내가 없었음.
- **파일**: `capture/lib/permission.ts`(신규)·`permission.test.ts`(신규 3케이스)·`useImagePicker.ts`(거부 시 호출)·`.maestro/SCENARIOS.md`(S17)·`.maestro/permission-denied.yaml`(신규, 반자동)·spec `0014`.
- **게이트**: ✅ ALL PASS — mobile 단위 5스위트/25테스트(permission 포함), api 4/19.
- **다음/주의**: S17 e2e는 OS 권한 다이얼로그가 시뮬레이터에서 브리틀 → 반자동(안내 로직은 단위가 확정). **SCENARIOS.md·JOURNAL은 #49(S16)와 같은 지점 수정 → 두 PR 순차 머지 시 충돌 예상, 둘 다 보존해 해소**. 다음 = 시나리오 백필 S9~S15.

## 2026-09-22 · Claude · #49 로그인 실패 친화 문구 매핑 (S16 공백 수정)
- **무엇**: 로그인 실패 시 `e.message` 원문 노출/취소도 에러 표시하던 UX 공백 수정. 순수 매핑 함수 `lib/loginError.ts` 추가 → `useKakaoLogin`이 위임.
- **왜**: e2e 시나리오(S16)를 쓰려다 드러난 공백 — placeholder 시나리오 대신 **실제 동작을 먼저 구현**하고 그 위에 시나리오를 얹기로(사용자 지시). 취소는 실패 아님, 네트워크/서버 원문은 사용자에게 부적절.
- **파일**: `auth/lib/loginError.ts`(신규)·`loginError.test.ts`(신규 8 assert)·`useKakaoLogin.ts`(위임)·`.maestro/SCENARIOS.md`(S16)·`.maestro/login-failure.yaml`(신규, 반자동)·spec `0013`.
- **게이트**: ✅ ALL PASS — mobile 단위 5스위트/26테스트(loginError 포함), api 4/19.
- **다음/주의**: S16 e2e는 백엔드 다운+카카오 수동이라 반자동(매핑은 단위가 완전 커버). 다음 = #50 권한 거부 안내(S17), 그 후 시나리오 백필 S9~S15. 취소 code 문자열은 SDK 실값과 다를 수 있어 code+message 이중 판별.

## 2026-09-19 · Claude · #47 Maestro e2e 플로우 하드닝 (실행 검증)
- **무엇**: `maestro` CLI 설치 후 e2e 플로우 5개를 **실제 실행**해 검증(그동안 "작성만" 됨). 브리틀 2건 수정.
- **발견(실행으로)**: ① Maestro 텍스트 매칭 = 요소 **전체 텍스트 정규식** → 긴 문장의 **부분 문자열 assert 실패**(화면엔 보이는데). ② `clearState` 재실행 직후 번들 로딩/복원 스플래시로 고정 `assertVisible` 성급 실패.
- **변경**: `profile.yaml`(FAQ 답변 `.*불리할 수 있는 조항을 찾아.*` + `waitForAnimationToEnd`), `login.yaml`·`capture-gate.yaml`(첫 화면 `extendedWaitUntil`).
- **게이트/검증**: maestro test **5/5 PASS**(capture-gate·login[카카오 수동]·session-restore·profile·logout). checks.sh 무관(문서/테스트 플로우).
- **다음/주의**: login/카카오는 자격증명 수동(자동화 불가) → #22 CI에선 테스트 계정 딥링크나 백엔드 목 경로 필요. Maestro 부분매칭은 `.*` 규칙으로.

## 2026-09-19 · Claude · #45 지침서 갱신 (세션 함정·리뷰 규칙·게이트·FSD 기준)
- **무엇**: 이번 세션에서 드러난 반복 함정·규칙을 지침서에 반영(docs). REFLECT의 일부.
- **변경**: ① `environment.md` — iOS/Metro 함정 섹션(디자인 깨지면 `expo start --clear`·iOS 빌드 `LANG=UTF-8`·시뮬 탭=포인트·CNG·PIPESTATUS) + RN 0.86.3 정정 + 게이트 설명 8검사. ② `evals/README.md` — 게이트 표 2→8검사, 유닛/e2e 위치 명시(진실 소스는 checks.sh). ③ `loop.md` — §7 PR 리뷰 대응(인라인 답글+resolve·false-premise 근거 반려) + **§테스트 필수(매 코드 태스크 단위+e2e 무조건, 시나리오 필요시 추가)** + §3·self-check에 shared-first/테스트 반영. ④ `frontend-architecture.md` — 공유 UI 승격 **shared-first**(도메인 결합 UI만 feature, 나머지 왠만하면 packages/ui) + tailwind content `./src/**` 필수. ⑤ `TASKS.md` — MenuRow는 shared-first상 승격 대상으로 정정.
- **왜**: 사용자 지정 상시 규칙 2건(테스트 무조건·shared-first) + 세션 함정(디자인 깨짐 오판·리뷰 스레드 방치·낡은 게이트 문서) 반복 방지.
- **게이트**: ✅ 8/8 PASS(문서 변경).
- **다음/주의**: 문서 전용이라 pr-ai-review는 docs-only 스킵. 다음 실무는 #15 presign / 세션 하드닝 / entitlement.

## 2026-09-19 · Claude · #43 공유 UI 승격 (IconBadge·SectionHeader) + 색상 토큰화
- **무엇**: 피처 중복 UI를 `packages/ui`(shared)로 승격 + capture 하드코딩 색 토큰화. 외부 동작 불변(refactor).
- **왜**: 재사용 패턴 중복 제거 + raw hex→토큰 일관성(가드레일).
- **변경**: A) `IconBadge`(원형 tint+아이콘, EmptyState·ProfileScreen 사용) B) `SectionHeader`(muted 섹션 라벨, ProfileScreen·FaqSection 3곳) C) capture(PageItem·PageList·EmptyState) 아이콘색 hex→`semantic`(#2563EB→primary·#64748B→textMuted 정확, #B6BCC7→borderStrong 정규화).
- **판단(FSD rule of three)**: A(2피처)·B(3회) 승격 / `MenuRow`는 단일 사용 → 백로그(과설계 방지).
- **파일**: `packages/ui/src/{icon-badge,section-header}.tsx`+index, `apps/mobile/src/features/{capture/ui/EmptyState·PageItem·PageList, profile/ui/ProfileScreen·FaqSection}.tsx`, `agents/orchestration/TASKS.md`(백로그 C), spec `0012`.
- **게이트**: ✅ PASS. **시뮬레이터 스모크(실 로그인)**: Capture(IconBadge)·프로필(IconBadge·SectionHeader) 렌더 **동일** 확인(회귀 없음).
- **함정**: 브랜치 전환+pnpm 재설치 churn으로 Metro/nativewind 상태 깨져 무스타일 렌더 → **Metro `--clear` 재시작**으로 해결(코드 문제 아님, 앞선 세션과 동일 부류).
- **다음/주의**: 스택 PR(base #38). C 승격은 2번째 사용처 생길 때. 다크모드 시 Icon 색도 스킴 반응 검토.

## 2026-09-19 · Claude · #41 테스트 — 전 기능 단위 테스트 + e2e 시나리오
- **무엇**: 테스트 인프라 도입(전무했음) + 전 기능 단위 테스트 41개 + e2e 시나리오/Maestro 플로우.
- **왜**: 회귀 안전망. 게이트에 테스트 편입으로 "done" 기준 강화.
- **단위(api, Jest+ts-jest, 19)**: TokenService(서명/검증·refresh 생성·해시 결정성)·AuthService(upsert·회전·만료/폐기 401·logout)·KakaoVerifier(/v2/user/me 파싱·실패 401)·JwtAuthGuard(유효/무효/누락).
- **단위(mobile, jest-expo+@testing-library, 22)**: secureSession(JSON 원자적·손상값 삭제·best-effort)·authApi(fetch 목·에러)·authStore(restore/setSession/signOut 상태전이)·faq.
- **e2e**: `apps/mobile/.maestro/`에 SCENARIOS.md(S1~S8 Given/When/Then) + 플로우 5개(capture-gate·login·session-restore·profile·logout). 카카오 자격증명은 수동.
- **파일**: `apps/api/`(jest.config.js·tsconfig.spec.json·*.spec.ts·package.json test), `apps/mobile/`(jest.config.js·jest.setup.js·*.test.ts·.maestro/·package.json test·tsconfig 제외), `agents/harness/evals/checks.sh`(Unit tests 2줄 추가 → 8검사).
- **게이트**: ✅ 8/8 PASS (typecheck×2·prisma·expo-doctor·lockfile·native-singleton·**unit api·unit mobile**).
- **함정·해결(중요)**: ① ts-jest가 jest 전역 못 찾음 → api는 `tsconfig.spec.json`(types에 jest) 별도, 빌드 tsconfig는 `**/*.spec.ts` exclude. mobile은 `**/*.test.ts(x)` exclude. ② jest-expo가 pnpm `.pnpm` 하위 RN/Expo 미트랜스파일 → `transformIgnorePatterns`를 **`.pnpm` 인식**(스코프는 `@scope+name`) 단일 패턴으로. ③ `clearMocks`는 구현 누수 → `resetMocks:true`. ④ 증분 설치가 node_modules를 반쪽 상태로 만들어 nativewind className 타입 깨짐 → **`pnpm install` 재정합**으로 해결.
- **다음/주의**: 컴포넌트 렌더 테스트(FaqSection/ProfileScreen)는 네이티브(svg/skia) 목이 필요해 e2e(Maestro)로 커버. #22 CI에서 checks.sh 실행 시 test까지 자동.

## 2026-09-19 · Claude · #36 앱 카카오 로그인 — 화면 + 세션 + e2e
- **무엇**: 앱 쪽 카카오 로그인 구현·검증. `@react-native-kakao/{core,user}` + Expo config plugin + `initializeKakaoSDK` + `expo-secure-store`. `src/features/auth/`(lib/secureSession·api/authApi·model/authStore·useKakaoLogin·ui/LoginScreen) + `app/login.tsx` + `_layout.tsx` 게이트 3상태 + `app/index.tsx` 로그아웃. #32 백엔드 auth를 실제로 켜서 e2e 갭 닫음.
- **왜**: #32는 백엔드만 실측(부팅·401). 실 카카오 로그인 e2e 미검증 → per-user 기능의 전제.
- **설계(Codex 회의 반영)**: UI보다 **네이티브 검증 선행**(기준선→SDK추가→prebuild→회귀 스모크). 게이트 **3상태(복원 중/비인증/인증)**, SecureStore엔 백엔드 access·refresh 저장(카카오 토큰 아님), 복원 시 `/auth/me` 서버 검증(토큰 존재만으로 인증 금지). `authApi`는 FSD `api/` 세그먼트. app.json→app.config.ts(env로 네이티브 키 주입, 하드코딩 없음).
- **파일**: `apps/mobile/`: `app.config.ts`(신규)·`.env.example`·`.env`(gitignore)·`app/_layout.tsx`·`app/index.tsx`·`app/login.tsx`·`src/features/auth/**`·`tailwind.config.js`·`package.json`. spec `0009-app-kakao-login.md`.
- **게이트**: ✅ 6/6 PASS(Expo Doctor 21/21). **시뮬레이터 e2e 실측(iPhone 17 Pro, 로컬 API+docker Postgres)**: 로그인→DB에 User(provider=KAKAO, displayName=실프로필)·RefreshToken 생성 → capture 진입 / 재시작→세션 복원(capture) / 로그아웃→RefreshToken 0건·로그인 복귀.
- **함정·해결(중요)**: ① CocoaPods가 Ruby 4.0+비UTF8 로케일에서 크래시 → `LANG=en_US.UTF-8`로 빌드. ② tailwind `content`에 `./src/**` **누락**(숨은 버그) → FSD 피처 className 미생성 → 추가(capture 아이콘 배경도 정상화). ③ iOS 시뮬레이터 탭 좌표는 **포인트(402×874)** 기준(스크린샷 픽셀 아님). ④ config plugin이 Swift AppDelegate `application(_:open:)` 맨앞에 카카오 URL 체크 삽입 → expo-router 링킹과 공존 확인.
- **다음/주의**: refresh 자동 회전·동시요청 병합, entitlement(무료 3회), `분석하기` 게이트 연결, Apple 로그인(4.8)은 후속. 카카오톡 앱 전환/실기기 웹 콜백은 실기기 검증 몫. zod 계약(packages/contracts) 정식화도 후속.

## 2026-09-18 · Claude · #32 인증(Auth) 구현 — 카카오 소셜 로그인 + JWT
- **무엇**: auth 모듈(카카오 로그인 + JWT 세션). `POST /auth/{kakao,refresh,logout}` · `GET /auth/me`(보호). `User`·`RefreshToken` 모델 추가. spec 0008 기준.
- **왜**: 서버 도메인 토대(per-user). documents·presign(#15) 등의 선행.
- **설계**: (A) 앱 주도 — 앱 카카오 access token → 백엔드가 `/v2/user/me` **재검증** → User upsert → **access(JWT) + 불투명 refresh(DB sha256 해시·회전)**. 카카오 검증에 서버 키 불필요. `SocialVerifier` 포트 + `KakaoVerifier` 어댑터(Apple 재개 시 어댑터만 추가). `JwtAuthGuard`+`@CurrentUser`.
- **파일**: `packages/db/prisma/schema.prisma`(User·RefreshToken·enum), `apps/api/src/modules/auth/**`(controller·service·module·token·guards·decorators·ports·adapters), `app.module.ts`, `apps/api/package.json`(@nestjs/jwt), `.env.example`(JWT env).
- **게이트**: ✅ 6/6 PASS. **부팅 실측**(DB 없이): 5개 라우트 매핑 + `/health` 200 + `/auth/me` 무토큰 **401** + `/auth/kakao` 빈바디 **401**.
- **함정·주의**: `@nestjs/jwt` `expiresIn`이 `string`(예 "15m") 대신 `ms.StringValue` 요구 → **초 단위 number(900)** 로 해결(캐스팅·우회 없이). 마이그레이션(User·RefreshToken)은 docker Postgres에서 `migrate dev` 실측 완료. **미완(실기기 필요)**: 실 카카오 로그인 e2e(앱 SDK). 바디 검증은 지금 수동 → 프론트 연동 시 zod 계약(packages/contracts) 정식화 후속.

## 2026-09-17 · Claude · #14 NestJS API 스캐폴드 + packages/db(Prisma)
- **무엇**: `apps/api` NestJS 11 스캐폴드(모듈러 모놀리스 골조: `modules/health`·`db/{PrismaService,DbModule}`·ConfigModule 전역) + `packages/db` Prisma 6(schema=Postgres, 고정경로 client 생성). `GET /health` 동작. 게이트에 api typecheck + Prisma validate 편입.
- **왜**: #15(presign) 전에 부팅되는 백엔드 뼈대 + DB 계층 필요.
- **파일**: `apps/api/**`(package.json·tsconfig·nest-cli·src), `packages/db/**`(package.json·prisma/schema.prisma·.gitignore), `agents/harness/evals/checks.sh`(api·db 검사), `pnpm-workspace.yaml`(allowBuilds: prisma·@prisma/client·@prisma/engines·@nestjs/core), `agents/intent/specs/0007-*.md`. `apps/mobile/package.json`(expo 패치 드리프트 정렬-부수).
- **게이트**: ✅ 6/6 PASS. **부팅·`/health` 200 실측**: `node dist/main.js`(DATABASE_URL env, 실 DB 없이) → `{"status":"ok",...}`.
- **함정·해결(중요)**: ① `@prisma/client`가 pnpm의 **typescript peer 변형별 2개**로 갈려 "did not initialize" → generator `output` **고정경로**(`packages/db/generated/client`)로 해결, api는 `@clause-lens/db`에서 import. ② `PrismaClient` 생성에 `DATABASE_URL` env 필요(연결 아님) → `.env`로 주입. ③ 부팅 시 DB 연결 강제 안 함(지연 연결)이라 docker 없이 뜸.
- **다음/주의**: 실 DB 연결·첫 마이그레이션은 #15에서 docker 필요. `generated/`·`dist/`는 gitignore(install 시 재생성). expo 드리프트 반복 → #22 CI에서 근본 대응.

## 2026-09-15 · Claude · #29 스토리지 결정 정정 (프로덕션 Railway Bucket / 로컬 MinIO)
- **무엇**: 스토리지를 **프로덕션 = Railway Storage Bucket(관리형 S3 호환)**, **로컬 개발 = MinIO(docker-compose)** 로 정정. architecture.md ADR·README·backend-architecture·spec 0004·docker-compose·.env.example 갱신.
- **왜**: 초기 ADR "MinIO 자체호스팅"은 "Railway엔 Volume뿐"이라는 잘못된 전제. Railway에 관리형 Storage Bucket 존재 → 비용·운영 압도적 우위.
- **비용 근거(railway.com/pricing 실측)**: Bucket `$0.015/GB·월 + egress 무료` vs MinIO(상시 컨테이너 ~$3~5/월 + Volume `$0.15/GB·월`). MVP 10GB ≈ $0.15 vs $4.5~6.5 (약 30~40배). GB단가도 Bucket이 Volume의 1/10.
- **파일**: `agents/context/architecture.md`(인프라 ADR·경계·백엔드결정), `README.md`(인프라 표·정의노트·다이어그램), `agents/context/backend-architecture.md`, `agents/intent/specs/0004-infra-decision-railway.md`, `docker-compose.yml`·`.env.example`(로컬 전용 명시)
- **게이트**: ✅ ALL PASS.
- **다음/주의**: 둘 다 S3 호환이라 코드 동일(`S3_*` 환경변수만 교체, `StoragePort` 격리). Notion `08. 인프라·배포`는 이미 Railway Storage Bucket으로 맞음. 배포 시 path-style·region·CORS는 설정 조정 + 업로드 1회 실검증 필요. #15 presign은 이 기준으로.

## 2026-09-14 · Claude · #13 로컬 개발 환경 (docker-compose)
- **무엇**: 루트 `docker-compose.yml`(PostgreSQL 17·Redis 7·MinIO + `createbuckets` 원샷) + `.env.example` + `.gitignore`에 `.env` 추가 + `environment.md` 로컬 인프라 절차. `docker compose up -d` 한 번으로 3종 기동 + 버킷 자동 생성.
- **왜**: 백엔드(#14) 개발에 DB·큐·스토리지가 로컬에 필요. 프로덕션 MinIO와 동일 S3 API를 로컬 재현.
- **파일**: `docker-compose.yml`(신규), `.env.example`(신규), `.gitignore`(.env 추가·!.env.example), `agents/harness/environment.md`, `agents/intent/specs/0006-local-dev-environment.md`(신규 spec)
- **게이트**: ✅ ALL PASS. `docker compose config` 문법·스키마 검증 통과. `.env` gitignore·`.env.example` 추적 확인.
- **다음/주의(정직)**: 이 환경은 **docker 데몬 미실행**이라 실제 `up`·healthcheck·버킷 생성·콘솔 접속은 **로컬에서 미검증** → 사용자 머신에서 관측 필요. 포트(5432/6379/9000/9001) 충돌 시 `.env`로 변경. 자격증명은 로컬 throwaway(프로덕션은 Railway 관리형).

## 2026-09-14 · Claude · #26 백엔드 아키텍처 결정 (ADR + 지침서)
- **무엇**: NestJS 백엔드 내부 아키텍처 확정. 모듈러 모놀리스 + Controller→Service→Repository 3층 + 외부 경계만 포트(Storage/Queue/OCR) + **Prisma**(`packages/db`) + `apps/*`+`packages/*` 레이아웃. zod(API)/Prisma(DB) 계약 층 분리.
- **왜**: 프론트는 FSD로 정해졌으나 api·worker 조직 기준이 없어 두 AI 일관성 위험. 백엔드 착수(#14)의 전제.
- **파일**: `agents/context/backend-architecture.md`(신규 지침서), `agents/context/architecture.md`(백엔드 결정 섹션 + packages/db), `AGENTS.md`(Context 링크), `agents/harness/guardrails.md`(백엔드 레이어 경계), `agents/intent/specs/0005-backend-architecture.md`(ADR)
- **게이트**: ✅ ALL PASS (문서 변경).
- **다음/주의**: 결정 근거·대안(레이어링·ORM Prisma vs Drizzle·레이아웃 apps vs front/back)은 ADR 0005에. worker는 api import 금지(공유는 packages/db·contracts). 실제 구조 검증은 #14 스캐폴드에서.

## 2026-09-14 · Claude · #12 인프라 결정 문서화 (Railway 단일 벤더)
- **무엇**: 인프라를 **Railway 단일 벤더**로 확정한 결정을 README·architecture.md에 반영. 큐 `SQS→Redis·BullMQ`, 스토리지 `S3→MinIO(S3 호환)`, 배포 전부 Railway, 외부 의존은 Google Vision만. architecture.md에 인프라 ADR(근거·대안·트레이드오프) 신설. 프론트 스택 RN 0.86.3 정정.
- **왜**: 문서가 AWS(SQS·S3) 전제라 실제 배포(Railway)와 어긋남 → 두 AI가 다른 인프라를 가정할 위험.
- **파일**: `README.md`(인프라 표·서버구성·4개 mermaid), `agents/context/architecture.md`(ADR), `agents/intent/specs/0004-infra-decision-railway.md`(신규 spec)
- **게이트**: ✅ ALL PASS (문서 변경, 코드 영향 없음).
- **다음/주의**: "S3"는 문서 전반에서 S3 호환 스토리지(MinIO)를 뜻함(정의 노트 명시). 실제 인프라 구축은 #13(docker-compose)·#14(NestJS 스캐폴드)에서 이 ADR 기준으로. AWS 직접 의존 없음.

## 2026-09-14 · Claude · #23 PR 리뷰 노이즈 감소 (docs-only 스킵 + P1-only)
- **무엇**: `pr-ai-review.mjs`에 (1) **문서 전용 PR(모든 변경 .md/.mdx) 코드 리뷰 스킵**, (2) **P1만 인라인**(P2/P3는 요약 개수만) 추가. 프롬프트에 "P1 집중·메타 지적 금지" 지시.
- **왜**: 진단 결과 리뷰는 PR당 1회지만(증분 정상 작동) **findings 과다**가 문제. 특히 문서 PR에 "정책인데 CI 강제 안 됨" 류 P2 메타 지적 다수 → 개발 흐름 저해.
- **파일**: `.github/scripts/pr-ai-review.mjs`, `agents/harness/github-pr-review-workflow.md`, `agents/intent/specs/0003-quiet-pr-review.md`(신규 spec)
- **게이트**: `node --check` PASS + docs-only 판정 6케이스 단위검증 ALL PASS. (실제 스킵·P1-only 동작은 머지 후 관측.)
- **다음/주의**: docs 판정은 **확장자(.md/.mdx)** 기준 — 경로 기준은 `agents/**/*.mjs`·`checks.sh` 오탐이라 회피. P2를 완전 은폐하진 않음(요약에 개수). SDD/PRD 상시 규칙의 첫 정식 적용(spec 0003 선작성).

## 2026-09-14 · Claude · #20 SDD/PRD 상시 기록 규칙 + 오늘 작업 REFLECT
- **무엇**: (1) "태스크마다 SDD/PRD를 **무조건** 파일로 남기고 문서 없이 BUILD 금지" 규칙을 loop·guardrails·intent README에 반영. (2) 보류돼 있던 workflow 문서 보강분(loop 9단계·§4/§6/§9, guardrails 브랜치 규칙, orchestration 브랜치 전략)을 함께 커밋. (3) 오늘 #16·#18의 결정·대안·검증을 소급 SDD(`specs/0002`)로 기록. (4) 네이티브 모듈 단독 버전변경 금지 규칙 guardrails에 추가.
- **왜**: 사용자가 결과는 보지만 **과정(왜·대안·근거)** 을 볼 수 없음. JOURNAL은 사후 결과 로그라 과정을 못 담음 → SDD/PRD가 그 자리. 과정을 항상 파일로 남겨 관측 가능하게.
- **파일**: `agents/harness/loop.md`(DEFINE=PRD·PLAN=SDD·§4 파일영구화·자기점검), `agents/harness/guardrails.md`(SDD/PRD 무조건 + 네이티브 단일버전), `agents/intent/README.md`(무조건 규칙·역할분리), `agents/orchestration/README.md`, `agents/intent/specs/0002-dependency-and-ci-hardening.md`(신규)
- **게이트**: ✅ ALL PASS (Typecheck + Expo Doctor 21/21 + lockfile + native 단일버전).
- **다음/주의**: 역할 분리 준수 — **SDD/PRD=사전·과정·근거, JOURNAL=사후 결과**. 앞으로 모든 태스크는 `intent/specs/NNNN-슬러그.md`부터 시작(사소한 chore도 SDD의 대안·검증은 필수). 미완: #12 인프라 문서(stash@{0})는 아직 별도로 남아 있음.

## 2026-09-14 · Claude · #18 PR AI 리뷰 증분 + 맥락 기반 개선
- **무엇**: `pr-ai-review.mjs`를 (a) **증분 리뷰**(직전 리뷰 sha 이후 변경분만, compare API) (b) **맥락 전달**(구간 커밋 메시지 + 이전 AI 리뷰 코멘트를 프롬프트에 포함, 반복 지적 억제)로 개선.
- **왜**: 매 push마다 PR 전체를 재리뷰 + 리뷰어가 기억이 없어 이미 해결·기각한 지적(예: pnpm overrides 위치)을 무한 반복 → 개발 흐름 저해. 변경분만 + "이미 다룬 건 반복 금지"로 수렴시킴.
- **파일**: `.github/scripts/pr-ai-review.mjs`(buildReviewPrompt·main), `agents/harness/github-pr-review-workflow.md`
- **핵심 설계**: 마지막 리뷰 sha는 이전 리뷰 body의 마커(`<!-- ai-pr-review:SHA -->`)에서 추출. compare status가 `ahead`/`identical`일 때만 증분, `diverged`/`behind`/실패면 **전체 리뷰 fallback**. 인라인 코멘트 유효성은 여전히 **PR 전체 diff** 라인 기준(코멘트 정상 등록 보장). 증분 대상에 새 패치 없으면 리뷰 스킵. `synchronize` 트리거는 유지.
- **게이트**: `node --check .github/scripts/pr-ai-review.mjs` PASS. sha 추출·compare 게이팅 로직 목데이터 단위검증 PASS. (실제 리뷰 동작은 이 변경 머지 후 다음 PR push에서 관측 필요.)
- **다음/주의**: 실제 GitHub 실행 검증은 머지 후 관측으로만 가능(로컬에서 GitHub/OpenAI 호출 불가). 리뷰가 여전히 반복되면 프롬프트의 반복-금지 지시 강도나 priorFindings 전달 범위를 조정.

## 2026-09-14 · Claude · #16 Expo SDK 57 버전 정렬 · 게이트 복구
- **무엇**: 완료 게이트를 막던 Expo 패키지 버전 드리프트 정리. `apps/mobile` 6개 패키지(expo·expo-constants·expo-image-picker·expo-linking·expo-router, react-native 0.86.2→0.86.3)를 SDK 57 기대치로 정렬하고, `packages/ui`의 `react-native`도 0.86.3으로 함께 올림.
- **왜**: 베이스라인에서 Expo Doctor가 버전 드리프트로 FAIL → 모든 태스크의 완료 게이트를 막는 공용 블로커였음.
- **파일**: `apps/mobile/package.json`, `packages/ui/package.json`, `pnpm-lock.yaml`
- **PR 리뷰 반영(재발 방지 강제화)**: ① `pnpm-workspace.yaml` overrides에 `react-native`·`react-native-worklets`·`react-native-reanimated` 추가 → 워크스페이스 단일 버전 강제(기존 `react-native-svg` override와 동일 위치·패턴). ② `.gitignore`에 `package-lock.json`·`yarn.lock` 추가. ③ `checks.sh` "No npm/yarn lockfiles" 게이트를 `find`(node_modules만 제외, 전체 깊이) 기반으로 추가 → nested lockfile까지 잡음. ④ 워크스페이스 레벨 "Native modules single version" 게이트 추가(`check-native-singletons.mjs`) — apps/mobile expo-doctor에 의존하지 않고 `pnpm list -r` resolved 버전을 직접 검사.
- **overrides 위치 검증(리뷰 반박)**: pnpm **11**에서 overrides는 `pnpm-workspace.yaml`이 정식 위치(pnpm 10+에서 이동). "package.json에 있어야 무시 안 된다"는 지적은 구버전 기준이라 **틀림**. 증거: (a) `pnpm-lock.yaml` 상단에 override 4개가 실제 기록됨, (b) `packages/ui`가 `react-native: 0.86.2`를 선언해도 **resolved는 0.86.3**(override 승리, `pnpm why`상 0.86.2 참조처 없음), (c) override 제거+버전 어긋냄 시 새 게이트가 `2개 버전`으로 정확히 FAIL. *(주의: pnpm store에는 아무도 참조 안 하는 orphan 엔트리가 `store prune` 전까지 남으므로, 검증은 store 디렉터리 개수가 아니라 `pnpm list` resolved로 해야 함.)*
- **게이트**: ✅ PASS (Typecheck + Expo Doctor 21/21 + lockfile 가드 + native 단일버전, 모두 PASS)
- **다음/주의(중요)**: SDK 버전업 시 **overrides + 앱 + `packages/ui`를 함께** 올릴 것. `expo install --fix`는 앱 package.json만 건드림. 새 네이티브 모듈 추가 시 `check-native-singletons.mjs`의 `TARGETS`와 overrides 목록을 함께 갱신.

## 2026-08-19 · Codex · #OPS-PR-REVIEW-WORKFLOW
- **무엇**: GitHub Actions 기반 PR 자동 리뷰 워크플로 추가. `pull_request_target` 이벤트에서 PR diff를 읽고 OpenAI Responses API로 리뷰한 뒤, actionable finding만 inline PR review comment로 남기는 흐름 구현. 중복 방지용 `head.sha` 마커 추가.
- **왜**: PR마다 반복되는 1차 코드 리뷰를 자동화하고, 버그·회귀·가드 누락 중심의 고신호 피드백을 빠르게 남기기 위함.
- **파일**: `.github/workflows/pr-ai-review.yml`, `.github/scripts/pr-ai-review.mjs`, `agents/harness/github-pr-review-workflow.md`, `agents/harness/README.md`
- **게이트**: `node --check .github/scripts/pr-ai-review.mjs` PASS. `checks.sh`는 네트워크 차단으로 FAIL(`pnpm` 패키지 다운로드 ENOTFOUND, `expo-doctor`의 `exp.host` 조회 실패).
- **다음/주의**: 저장소 secret `OPENAI_API_KEY` 필요. 선택 variable `OPENAI_MODEL` 지원. 큰 PR은 patch 일부만 검토. changed line에 매핑되지 않는 finding은 드롭.

## 2026-08-19 · Claude · #TASK-001 캡처 화면 (이미지 촬영·선택 + Draft) 완료
- **무엇**: FSD `features/capture` 구현. model(draftStore Zustand·useImagePicker·types) + ui(CaptureScreen·EmptyState·PageList·PageItem). 촬영/갤러리→Draft 추가, 목록(썸네일)·순서 라벨·삭제·교체·드래그 재정렬(draggable-flatlist), 분석하기 버튼(동작은 TASK-003). 서버 없음, 로컬 Draft만.
- **왜**: 첫 사용자 기능(스펙 0001). 앱에 계약서 이미지 들여와 정리하는 진입.
- **의존성**: zustand, expo-image-picker(~57.0.11), react-native-draggable-flatlist(4), react-native-gesture-handler(2.32, SDK 정렬). `_layout`에 GestureHandlerRootView + SafeAreaProvider.
- **게이트**: typecheck + expo-doctor 21/21. **네이티브 리빌드 1회**(build-time 200s) 후 시뮬 실동작 검증: 빈 상태→갤러리 picker→사진 선택→2페이지 추가→썸네일 렌더까지 스크린샷 확인.
- **검증 중 발견·수정한 실버그 2개**:
  1. **크래시**: `expo-image-picker`가 사진/카메라 접근 시 Info.plist 사용목적(NSPhotoLibraryUsageDescription·NSCameraUsageDescription) 필수 → 없으면 TCC 크래시. `app.json ios.infoPlist`에 추가(소스 오브 트루스). ios/는 gitignore라 app.json이 기준.
  2. **썸네일 미표시**: NativeWind `h-14 w-11`이 `Image`에 사이즈로 안 먹음 → 명시적 `style={{width,height}}`로 수정.
- **다음/주의**: (1) 카메라는 시뮬레이터에 없어 갤러리로만 검증(촬영은 실기기). (2) draggable-flatlist가 `InteractionManager deprecated` 경고 유발(라이브러리 내부, 무해). (3) 드래그/삭제/교체는 코드·타입 검증했으나 제스처 자동화 시각검증은 생략. (4) DraftPage는 클라 임시상태(feature/model), 서버 page는 TASK-002에서 entities/page+contract 승격. 브랜치 task/001-image-capture.

## 2026-08-18 · Claude · 결정: 앱 내부 아키텍처 = FSD
- **무엇**: `apps/mobile` 코드 조직을 Feature-Sliced Design으로 확정. 신규 문서 `context/frontend-architecture.md` 작성 + architecture.md·context/README·guardrails 반영.
- **왜**: 웹 FSD 감각을 RN에 전이 + 디바이스 API 격리 + zod 계약(packages/contracts) 연결을 규칙으로 고정.
- **핵심**: 레이어(screens·widgets·features·entities·shared) × 세그먼트(ui·model·api·lib). "api"는 레이어 아닌 세그먼트. import는 상위→하위만(guardrails에 경계 규칙 추가). zod: contracts→shared/api(parse)→entities/api, entity 타입=z.infer. FSD-lite(쓰는 것만, 과설계 금지).
- **파일**: `agents/context/frontend-architecture.md`(신규), `agents/context/architecture.md`(§FSD), `agents/context/README.md`(인덱스), `agents/harness/guardrails.md`(경계 규칙)
- **게이트**: 문서만.
- **다음/주의**: TASK-001은 `features/capture`(ui·model)로 구현. DraftPage는 클라 임시상태(feature model), 서버 page는 TASK-002에서 entities/page+contract 승격. entities 정의서 = context/domain-map + 도메인 문서.

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
