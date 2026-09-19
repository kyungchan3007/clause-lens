# Tool / Environment Engineering

에이전트가 쓸 수 있는 명령·도구·환경. 모든 명령은 **pnpm** 기준.

## 환경

| 항목 | 버전 |
| --- | --- |
| Node.js | 22 |
| pnpm | 11 |
| Expo SDK | 57 |
| React Native | 0.86.3 |
| React Native Skia | 2.6.2 |
| TypeScript | ~6.0.3 |

패키지 매니저는 pnpm 고정(`pnpm-lock.yaml`, `pnpm-workspace.yaml`). **npm/yarn 사용 금지.**

## 명령

```bash
pnpm install                  # 의존성 설치 (postinstall: canvaskit 복사)
pnpm exec expo start          # 개발 서버 (Metro)
pnpm exec expo run:ios        # iOS 개발 빌드
pnpm exec expo run:android    # Android 개발 빌드
pnpm web                      # 웹(static)
pnpm dlx expo-doctor          # 환경 점검 (별도 패키지)
pnpm exec tsc --noEmit        # 타입 체크
```

## 로컬 백엔드 인프라 (Docker)

백엔드(api·worker) 개발에 필요한 PostgreSQL·Redis·MinIO를 로컬에서 한 번에 띄운다. → [spec 0006](../intent/specs/0006-local-dev-environment.md)

```bash
cp .env.example .env          # 최초 1회 (실제 .env는 gitignore)
docker compose up -d          # Postgres·Redis·MinIO 기동 + 버킷 자동 생성
docker compose ps             # 상태 확인 (healthcheck)
docker compose logs -f minio  # 로그
docker compose down           # 중지 (데이터 유지)
docker compose down -v        # 중지 + 볼륨 삭제(초기화)
```

- **PostgreSQL** `localhost:5432` · **Redis** `localhost:6379`
- **MinIO** S3 API `localhost:9000` · 웹 콘솔 `http://localhost:9001` (기본 minioadmin/minioadmin)
- 버킷 `clause-lens`는 `createbuckets` 서비스가 자동 생성.
- 포트 충돌 시 `.env`에서 `*_PORT` 변경. 접속 정보는 [.env.example](../../.env.example).

> ⚠️ 프로덕션은 Railway 관리형(Postgres·Redis)+MinIO. 이 compose는 **로컬 전용**.

## 완료 게이트

```bash
bash agents/harness/evals/checks.sh
```

typecheck(mobile·api) + Prisma validate + expo-doctor + lockfile + 네이티브 단일버전 + **유닛 테스트(api·mobile)** 를 묶어 실행(8검사). 완료 선언 전 반드시 PASS. → [evals/README.md](evals/README.md)

## iOS·Metro 함정 (이 맥·이 세션에서 반복 확인)

- **디자인이 갑자기 무스타일로 깨질 때** (텍스트 좌상단 몰림·버튼 색 없음): 대개 **브랜치 전환·머지·`pnpm install` 후 Metro/nativewind 캐시가 흔들린 것**(코드 문제 아님). → Metro를 **캐시 클리어로 재시작**하고 앱 리로드:
  ```bash
  pnpm exec expo start --clear
  ```
- **iOS 빌드(`expo run:ios`·`expo prebuild`)는 UTF-8 로케일 필수.** 안 그러면 CocoaPods가 `Unicode Normalization not appropriate for ASCII-8BIT`로 크래시(Ruby + 비-UTF8 셸):
  ```bash
  LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm exec expo run:ios
  ```
- **iOS 시뮬레이터 자동화 탭 좌표는 포인트 기준**(스크린샷 픽셀 아님). `픽셀/이미지폭 × 포인트폭`으로 환산해서 탭.
- `ios/`·`android/`는 gitignore(CNG) — 네이티브 설정은 config plugin이 진실 소스. 네이티브 의존성 추가 후 `expo prebuild --clean` + 재빌드.
- 파이프(`... | tee log`) 종료코드는 tee 것 → 빌드 성공/실패는 `${PIPESTATUS[0]}`로 확인.

## UI 작업 도구 — `ui-ux-pro-max` 스킬 (필수)

**UI/UX 작업(화면·컴포넌트·색·타이포·레이아웃·접근성·모션) 시 반드시 이 스킬을 먼저 조회한다.** 검증된 UX 규칙·스타일·팔레트·RN 가이드를 감(感) 대신 근거로 쓴다. 위치: `.claude/skills/ui-ux-pro-max/` (프로젝트에 커밋됨 → 두 AI 공용).

호출은 **절대경로** 필수(상대경로는 Python path 에러):
```bash
SEARCH="$(git rev-parse --show-toplevel)/.claude/skills/ui-ux-pro-max/scripts/search.py"
python3 "$SEARCH" "<질의 2~5단어>" --domain ux          # ux·style·color·typography·icons·chart·gsap
python3 "$SEARCH" "<질의>" --stack react-native          # RN 0.86 스택 가이드
python3 "$SEARCH" "<제품 설명>" --design-system          # 새 화면/전체 방향(스타일+팔레트+타이포 한 번에)
```
- 질의는 **하나의 지배 의도** + 2~5개 의미 단어. 결과가 비면 **한 번 좁혀 재시도**, 그래도 없으면 "검증된 매치 없음"이라 밝히고 일반 가이드는 fallback으로 표기.
- 상세·전체 규칙: `.claude/skills/ui-ux-pro-max/SKILL.md`, `references/pro-rules.md`(앱 폴리시·safe area·터치), `references/quick-reference.md`(119 UX 규칙).
- 이 스킬 조회는 [guardrails](guardrails.md)의 UI 규칙으로 강제된다.

## 도구별 어댑터 (얇게 유지)

| 도구 | 파일 | 역할 |
| --- | --- | --- |
| Claude Code | `CLAUDE.md`, `.claude/settings.json` | `@AGENTS.md` import + 플러그인 설정만 |
| Codex | `AGENTS.md` (직접) | 별도 설정 없이 이 트리를 읽음 |

**규칙**: 도구별 파일에 **규칙 본문을 복제하지 않는다.** 규칙은 `agents/` 트리에만.

## 새 의존성 추가 시

1. Expo SDK 57 호환 확인 → https://docs.expo.dev/versions/v57.0.0/
2. `pnpm add <pkg>` (lock 갱신)
3. 네이티브 모듈이면 dev 빌드 재생성 필요 여부 확인
4. [SDD](../intent/templates/sdd.md)의 "새 의존성"에 근거 기록
