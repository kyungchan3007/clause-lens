# Guardrails — 해도 되는 것 / 절대 안 되는 것

에이전트가 사고를 치기 전에 막는 사전 규칙. 두 AI 공통.

## 🔴 절대 금지 (Hard stops)

- **버전 확인 없이 Expo 코드 작성 금지.** 항상 https://docs.expo.dev/versions/v57.0.0/ 먼저.
- **프론트에서 OCR 실행·위험 조항 판단 금지.** 서버 결과 표현만. → [architecture.md](../context/architecture.md)
- **비밀값 하드코딩 금지.** API 키, Google Vision 크리덴셜, S3 자격증명을 코드/커밋에 넣지 않는다.
- **민감정보 로그 금지.** 이미지 원문, OCR 전문·계약서 원문, 토큰·사용자 식별정보, Presigned URL을 로그에 남기지 않는다.
- **npm/yarn 금지.** pnpm만.
- **FSD import 경계 위반 금지.** (프론트) import는 상위→하위만(screens→features→entities→shared), 역방향 금지. `entities`는 `features`를 import하지 않는다. → [frontend-architecture.md](../context/frontend-architecture.md)
- **백엔드 레이어 경계 위반 금지.** (api·worker) Controller→Service→Repository 방향만. Service에서 Prisma·외부 SDK·fetch 직접 호출 금지(Repository/포트 경유). `worker`는 `api`를 import하지 않는다(공유는 `packages/db`·`packages/contracts`). → [backend-architecture.md](../context/backend-architecture.md)
- **UI 작업 시 `ui-ux-pro-max` 스킬 조회 없이 화면/컴포넌트 디자인 금지.** 색·타이포·레이아웃·접근성·모션은 감이 아니라 스킬의 검증된 가이드 기준. 호출법 → [environment.md](environment.md#ui-작업-도구--ui-ux-pro-max-스킬-필수)
- **SDD/PRD 없이 코드 작성 금지 (무조건).** 태스크 착수 시 `intent/specs/NNNN-슬러그.md`에 PRD(왜/무엇) + SDD(어떻게·**대안**·검증)를 먼저 남긴다. 채팅 출력이 아니라 **파일**로. 사소한 chore도 예외 없음. → [loop.md §4](loop.md#4-구현-전-게이트--sddprd-필수-코드보다-먼저)
- **네이티브 모듈 버전 단독 변경 금지.** react-native 계열 등 네이티브 모듈은 앱·`packages/ui`·`pnpm-workspace.yaml overrides`를 **함께** 정렬한다(한쪽만 올리면 중복→빌드 실패). 게이트의 "Native modules single version"이 검사. → [check-native-singletons.mjs](evals/check-native-singletons.mjs)
- **상대 AI가 `in-progress`로 점유한 태스크의 파일 편집 금지.** → [TASKS.md](../orchestration/TASKS.md)
- **게이트 미통과 상태로 "완료" 선언 금지.**
- **되돌리기 어려운 작업은 확인 먼저** — 파일/브랜치 삭제, 외부 전송, 설정·권한 변경, 커밋·푸시.

## 🟡 확인 후 진행 (Ask first)

- 새 런타임 의존성 추가 (특히 네이티브 모듈)
- 상태 관리 방식 변경 (Draft ↔ 서버 상태 경계)
- API 계약 형태 변경 (프론트-백 계약이라 양쪽 영향)
- 공용 문서(`agents/**`, `AGENTS.md`) 규칙 자체를 바꾸는 변경

## 🟢 자유롭게

- 스펙 범위 내 UI 구현·리팩터, 컴포넌트 추가
- `agents/intent/specs/`에 새 스펙 작성
- typecheck·문서 개선, 게이트 반복 실행

## 커밋/브랜치 규칙

- 사용자가 요청할 때만 커밋·푸시한다.
- `main`·`develop`에 직접 작업하지 않는다. 태스크마다 `task/<번호>-<슬러그>`를 **develop에서 분기**, PR은 **develop 대상**. → [브랜치 전략](../orchestration/README.md#브랜치-전략)
- 커밋 메시지는 무엇을·왜. 관련 태스크 `#TASK-xxx`와 스펙 번호 참조.

## 안전 기본값

- 파괴적 작업 전 대상을 먼저 확인(내가 만든 게 아니면 특히).
- 결과를 정직하게 보고: 테스트 실패는 실패라고, 건너뛴 단계는 건너뛰었다고.
