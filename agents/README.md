# ClauseLens 에이전틱 엔지니어링 아키텍처

이 디렉터리는 **두 AI 에이전트(Claude Code, Codex)가 동일한 규칙으로 협업**하기 위한 운영 체계입니다.
어떤 도구든 진입점은 루트 [`AGENTS.md`](../AGENTS.md) 하나이며, 아래 계층으로 뻗어나갑니다.

## 계층 구조

각 계층은 **동사 하나**로 판별합니다. 배치가 헷갈리면 이 표로 결정하세요.

| 계층 | 동사 | 판별 질문 | 예 |
| --- | --- | --- | --- |
| Context | **안다** | 무엇이 참인가? | 도메인 계약·불변조건 |
| Intent | **정의한다** | 무엇을 만들 것인가? (경계 포함) | 기능 정의·작업 스펙 |
| Harness | **실행한다** | 어떤 기계장치로 안전·반복 실행하나? (기능 불문) | loop·guardrails·eval |
| Orchestration | **엮는다** | 여러 에이전트를 어떻게 조율하나? | task DAG·worktree |

```
Agentic Engineering
├─ Intent Engineering          "정의한다 · 무엇을 만드는가"
│   ├─ features/   상시 기능 정의(경계·행동 흐름·수용조건)
│   ├─ specs/      작업 단위 스펙(설계 결정·AC 델타)
│   └─ templates/  PRD · SDD · Acceptance Criteria
├─ Context Engineering         "안다 · 무엇이 참인가"
│   ├─ architecture · glossary · Progressive Disclosure
│   └─ domain-map + 도메인 6(계약·불변조건, flat)
├─ Harness Engineering         "실행한다 · 기능 불문 기계장치"
│   ├─ Loop            (계획→구현→검증 루프)
│   └─ Tool / Environment
└─ Orchestration Engineering   "엮는다 · 여러 에이전트"
    └─ Subagents · Worktrees · Task DAG · Automations

Verification (위 전체를 가로지르는 직교축)  "믿을 수 있는가"
├─ Eval           (실행 가능한 게이트)
├─ Observability  (저널 · 로그)
└─ Guardrails     (해도 되는 것 / 안 되는 것)
```

> **배치 원칙 2가지 (실제 논쟁으로 확정됨)**:
> - **feature = Intent.** 기능을 *정의*(경계 포함)하므로. Harness는 기능-불문 기계장치라 per-feature 파일을 담지 않는다.
> - **domain = Context.** 도메인이 *무엇이 참인가*(계약·불변)를 다루므로. Intent가 배제하는 건 *엔지니어링* how이지 *행동* how가 아니다.

> **원래 트리와의 차이**: Eval·Observability·Guardrails를 Harness의 자식에서 꺼내
> **Verification 직교축**으로 승격했습니다. 이 셋은 "만드는" 활동이 아니라 "검증하는" 활동이라
> 모든 계층을 가로지르기 때문입니다. 또한 Eval 결과가 Intent(스펙)와 Context(문서)를
> 되먹이는 **피드백 루프**를 명시합니다 — 이 구조는 한 번 세팅으로 끝나지 않고 학습합니다.

```
        ┌──────────────── feedback ────────────────┐
        ▼                                           │
   Intent ─▶ Context ─▶ Harness ─▶ Orchestration ─▶ Verification
```

## 두 AI 협업 프로토콜 (가장 중요)

Claude와 Codex는 같은 저장소에서 동시에 움직일 수 있습니다. 충돌을 막는 3가지 규칙:

### 1) 단일 진실 소스
모든 규칙은 `AGENTS.md`와 이 `agents/` 트리에만 존재합니다. 도구 전용 파일(`.claude/`, `.codex/` 등)에 규칙을 복제하지 마세요. 도구별 파일은 **얇은 어댑터**여야 합니다.

### 2) 태스크 클레임 (동시 편집 방지)
작업 시작 전 [`orchestration/TASKS.md`](orchestration/TASKS.md)에서 태스크의 `owner`를 자신으로, `status`를 `in-progress`로 바꿉니다.
- 다른 에이전트가 `in-progress`로 점유한 태스크의 파일은 건드리지 않습니다.
- 가능하면 태스크마다 **별도 worktree/브랜치**에서 작업합니다 → [worktrees](orchestration/README.md#worktrees).

### 3) 공유 저널 (관찰 가능성)
작업이 끝나면 [`JOURNAL.md`](JOURNAL.md)에 한 항목을 append 합니다: 무엇을·왜·어떤 파일·게이트 결과. 상대 에이전트는 이 저널로 맥락을 이어받습니다.

## 완료의 정의 (Definition of Done)

한 태스크는 아래를 모두 만족해야 완료입니다.

- [ ] 해당 스펙의 Acceptance Criteria 충족
- [ ] `bash harness/evals/checks.sh` PASS
- [ ] Guardrails 위반 없음 ([harness/guardrails.md](harness/guardrails.md))
- [ ] `JOURNAL.md`에 기록, `TASKS.md` 상태 `done`으로 갱신

## 어디서부터 읽나

| 하려는 일 | 먼저 볼 파일 |
| --- | --- |
| 기능이 뭘 해야 하나(정의) | [intent/features/](intent/README.md) |
| 새 작업 스펙 작성 | [intent/README.md](intent/README.md) |
| 도메인 계약·불변조건 파악 | [context/domain-map.md](context/domain-map.md) → 도메인 문서 |
| 시스템 구조·상태 모델 | [context/architecture.md](context/architecture.md) |
| 지금 뭘 해야 하나 | [orchestration/TASKS.md](orchestration/TASKS.md) |
| 코드 쓰기 직전 | [harness/loop.md](harness/loop.md) · [harness/guardrails.md](harness/guardrails.md) |
