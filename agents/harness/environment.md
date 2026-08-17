# Tool / Environment Engineering

에이전트가 쓸 수 있는 명령·도구·환경. 모든 명령은 **pnpm** 기준.

## 환경

| 항목 | 버전 |
| --- | --- |
| Node.js | 22 |
| pnpm | 11 |
| Expo SDK | 57 |
| React Native | 0.86.2 |
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

## 완료 게이트

```bash
bash agents/harness/evals/checks.sh
```

typecheck + expo-doctor를 묶어 실행. 완료 선언 전 반드시 PASS. → [evals/README.md](evals/README.md)

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
