# Orchestration Engineering — "여러 에이전트를 어떻게 엮는가"

Claude와 Codex(그리고 각자의 subagent)가 **충돌 없이 병렬로** 일하게 조율하는 계층.

## 구성

| 요소 | 설명 |
| --- | --- |
| **Task DAG** | 태스크와 의존 관계. 라이브 보드: [TASKS.md](TASKS.md) |
| **Worktrees** | 태스크마다 격리된 작업 공간 (아래) |
| **Subagents** | 한 AI가 큰 태스크를 하위 작업으로 분해 (아래) |
| **Automations** | 게이트·저널 등 반복 절차의 자동화 (아래) |

## Task DAG

- 모든 작업은 [TASKS.md](TASKS.md)의 태스크로 표현. 각 태스크: `id · 제목 · owner · status · 스펙 · 의존(depends)`.
- `depends`가 걸린 태스크는 선행이 `done`이 되기 전 시작하지 않는다.
- **동시 편집 방지**: `status=in-progress`이고 owner가 상대 AI인 태스크의 파일은 건드리지 않는다.

상태: `todo → in-progress → review → done` (막히면 `blocked`).

## Worktrees

태스크는 가능한 한 **별도 브랜치/worktree**에서 진행해 두 AI가 물리적으로 분리되게 합니다.

```bash
# 태스크용 worktree 생성 (예: TASK-001)
git worktree add ../clause-lens-task-001 -b task/001-image-capture
# 작업 후
git worktree remove ../clause-lens-task-001
```

- 브랜치 규칙: `task/<번호>-<슬러그>`.
- `main`에서 직접 작업하지 않는다.
- 커밋·푸시는 사용자 요청 시에만. → [Guardrails](../harness/guardrails.md)

## Subagents

한 AI가 큰 태스크를 맡으면 하위 작업으로 나눠 병렬화할 수 있습니다(도구별 메커니즘 상이).

- 분해해도 **동일한 [Loop](../harness/loop.md)와 게이트**를 따른다.
- 하위 작업 결과를 모을 때, 통합 지점에서 `checks.sh`를 다시 돌린다.
- Subagent가 만든 결정·산출은 상위 태스크의 저널 항목에 요약한다.

## Automations

- **게이트**: `agents/harness/evals/checks.sh` — 완료 전 로컬 CI.
- (향후) CI에서 동일 게이트 실행, PR 시 자동 typecheck.
- (향후) 스케줄 작업/알림 등은 도입 시 여기에 문서화.

## 조율 한 장 요약

```
새 일 발생
   │
   ├─▶ TASKS.md에 태스크 추가 (id, 스펙, depends)
   │
   ├─▶ 에이전트가 CLAIM (owner=나, in-progress) ─┐  동시에 다른 에이전트는
   │                                              │  다른 태스크를 CLAIM
   ├─▶ worktree/브랜치에서 Loop 수행 ────────────┘
   │
   ├─▶ 게이트 PASS + Acceptance Criteria 충족
   │
   └─▶ JOURNAL.md 기록 + status=done
```
