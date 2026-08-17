# AGENTS.md — ClauseLens 에이전트 허브

> 이 파일은 **모든 AI 에이전트(Claude Code, Codex)의 단일 진입점**입니다.
> Codex는 이 파일을 직접, Claude Code는 `CLAUDE.md → @AGENTS.md` 경로로 읽습니다.
> 항상 컨텍스트에 로드되므로 **짧게 유지**하고, 세부 내용은 링크로 위임합니다(Progressive Disclosure).

## 0. 프로젝트 한 줄 요약

계약서·약관을 촬영 → OCR로 텍스트·좌표 추출 → 사용자에게 불리한 조항을 이미지 위에 하이라이트하는 Expo(React Native) 앱. 전체 도메인은 [README.md](README.md).

## 1. 절대 규칙 (Non-negotiable)

1. **Expo는 바뀌었다.** 코드를 쓰기 전에 반드시 버전 고정 문서를 확인한다: https://docs.expo.dev/versions/v57.0.0/
2. **서버가 진실의 기준이다.** 프론트는 OCR을 실행하거나 위험 조항을 판단하지 않는다. 서버 결과를 화면에 표현만 한다.
3. **완료 선언 전 게이트 통과 필수:** `bash agents/harness/evals/checks.sh` 가 PASS여야 "done"이라고 말할 수 있다.
4. **작업 전 클레임, 작업 후 기록:** [작업 보드](agents/orchestration/TASKS.md)에서 태스크를 점유하고, 끝나면 [저널](agents/JOURNAL.md)에 남긴다.

## 2. 에이전틱 엔지니어링 아키텍처

이 저장소는 두 AI가 동일한 규칙으로 협업하도록 아래 4+1 계층으로 구성됩니다. 전체 개요와 협업 프로토콜: **[agents/README.md](agents/README.md)**

각 계층은 동사 하나로 판별합니다: **Context=안다 · Intent=정의한다 · Harness=실행한다 · Orchestration=엮는다.**

| 계층 | 동사 / 질문 | 위치 |
| --- | --- | --- |
| **Intent** | 정의한다 · 무엇을 만드는가 | [features(상시 기능 정의)](agents/intent/features/) · [specs](agents/intent/specs/) · [templates](agents/intent/templates/) |
| **Context** | 안다 · 무엇이 참인가 | [architecture](agents/context/architecture.md) · [domain-map + 도메인 6](agents/context/domain-map.md) · [glossary](agents/context/glossary.md) |
| **Harness** | 실행한다 · 어떻게 안전하게 돌리나 (기능 불문) | [agents/harness/](agents/harness/README.md) |
| **Orchestration** | 엮는다 · 여러 에이전트를 어떻게 | [agents/orchestration/](agents/orchestration/README.md) |
| **Verification**(직교축) | 믿을 수 있는가 | [Eval](agents/harness/evals/README.md) · [Observability](agents/harness/observability.md) · [Guardrails](agents/harness/guardrails.md) |

## 3. 빠른 시작 (에이전트용)

```bash
pnpm install
pnpm exec expo start          # 개발 서버
bash agents/harness/evals/checks.sh   # 완료 전 게이트 (typecheck + expo-doctor)
```

전체 명령·환경: [agents/harness/environment.md](agents/harness/environment.md)

## 4. 작업 루프 (요약)

`태스크 클레임 → 스펙 확인 → 계획 → 구현 → 게이트(checks.sh) → 저널 기록 → 태스크 완료`
상세: [agents/harness/loop.md](agents/harness/loop.md)

이슈 초안 자동 정리 규칙: [agents/harness/github-issue-templates.md](agents/harness/github-issue-templates.md)
