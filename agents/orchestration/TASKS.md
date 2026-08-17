# 작업 보드 (Task DAG) — 두 AI 공용

> **작업 전 여기서 태스크를 CLAIM** 하세요: `owner`를 자신(Claude/Codex)으로, `status`를 `in-progress`로.
> 완료 시 `done`으로 바꾸고 [JOURNAL.md](../JOURNAL.md)에 기록.
> status: `todo · in-progress · review · done · blocked`

## 규칙
- 상대 AI가 `in-progress`로 점유한 태스크의 파일은 건드리지 않는다.
- `depends`의 선행 태스크가 `done`이 되기 전 시작하지 않는다.
- 태스크는 가능하면 `task/<번호>-<슬러그>` 브랜치/worktree에서.

## 태스크

| id | 제목 | 정의 (feature) | spec | owner | status | depends |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | 이미지 촬영·선택과 페이지 Draft 관리 | [capture-import](../intent/features/capture-import.md) | [0001](../intent/specs/0001-image-capture-and-draft.md) | – | todo | – |
| TASK-002 | S3 Presigned URL 연동·직접 업로드 | [capture-import](../intent/features/capture-import.md) | – | – | todo | TASK-001 |
| TASK-003 | 분석 요청·jobId 상태 폴링 | [analyze-document](../intent/features/analyze-document.md) | – | – | todo | TASK-002 |
| TASK-004 | OCR·위험 조항 결과 + Skia 하이라이트 표시 | [view-highlights](../intent/features/view-highlights.md) | – | – | todo | TASK-003 |
| TASK-005 | 로그인·무료 분석 횟수 | [login-entitlement](../intent/features/login-entitlement.md) | – | – | todo | – |
| TASK-006 | 구독·문서 저장 | [save-retain](../intent/features/save-retain.md) | – | – | todo | TASK-005 |
| TASK-007 | 특정 페이지 이미지 교체·재분석 | [replace-page](../intent/features/replace-page.md) | – | – | todo | TASK-003 |

> 위 태스크는 README "초기 개발 순서" + feature 정의를 DAG로 옮긴 시드입니다.
> 각 태스크의 **무엇/행동**은 연결된 feature 정의를 따르고, 별도 설계 판단이 필요하면
> [intent/specs/](../intent/specs/)에 spec을 추가합니다(TASK-001은 spec 0001 존재).

## 백로그 (아직 태스크화 안 됨)
- TanStack Query 도입 (서버 상태 캐시)
- Zustand store 구조 확정
- 에러/재시도 UX 공통 컴포넌트
