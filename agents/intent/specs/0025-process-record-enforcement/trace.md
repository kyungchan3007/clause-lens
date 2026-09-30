# 0025 — 과정 기록 (trace)

> 작업하며 실제 판단·막힘·되돌림을 남긴다. 자동 사실 기록은 `trace.auto.jsonl`(hook), 여기는 사람이 쓰는 판단 기록.

## 판단
- **훅 활성 위험**: harness-lab는 확장자 없는 ESM 훅 + `type:module`. ClauseLens 루트는 `type:module`이 아니고, 무엇보다 **라이브 desktop 세션에 PreToolUse guard가 켜지면 내 편집이 차단**될 수 있다. → 훅은 `.claude/settings.json`에 배선하되(새 세션에서 활성), 이번 검증은 훅 스크립트에 hook JSON을 직접 파이프로 넣어 확인(이슈의 "복사본에서 시험" 규칙 준수, 라이브 기록 오염 방지).
- **두 형식 공존**: 기존 0001~0024 단일 파일 spec을 폴더로 옮기지 않기로(면제) 결정 → 링크 보존·소급 작성 없음. check-issue-records(파일)와 check-task-records(폴더)를 분리해 충돌 회피.
- **브랜치→작업 매핑**: harness-lab은 `task/NNNN`(=spec 번호). ClauseLens 브랜치는 `<접두사>/<이슈번호>`. → 이슈번호로 spec(파일/폴더)을 찾는 방식으로 적응(`specForIssue`/`folderForIssue`).
- **역할 분리 미이식**: ClauseLens는 Claude(화면)·Codex(로직) 분리가 이미 있어 harness-lab의 3역할 권한은 옮기지 않음.

## 막힘 / 되돌림
- **표 블록 삭제 불가**(앞선 Notion 작업 교훈)와 무관하게, 이번엔 훅 검증을 라이브 세션에서 하지 않고 임시 git 저장소(복사본)에 hook JSON을 파이프로 주입해 확인 → 라이브 `trace.auto.jsonl` 오염 없음.
- **검증 결과**: guard = 폴더 spec 없을 때 exit 2 차단 + `.unassigned.jsonl`에 자동 기록(redact 확인) · 폴더 spec(prd·sdd) 있으면 허용 · 기록 경로는 항상 허용. stop-check = 코드 변경+trace 없음이면 `{decision:"block"}` 돌려보냄. 단위 12개 통과.
- **자동 기록 커밋 여부 결정**: `.claude/settings.json` 훅이 이 라이브 세션에 hot-reload돼 `0025/trace.auto.jsonl`에 부트스트랩 활동이 기록됨(이슈가 경고한 오염). → harness-lab와 달리 **ClauseLens는 `trace.auto.jsonl`을 gitignore**(세션별 대용량 append 로그·머지 충돌·부트스트랩 노이즈 회피). "작업 폴더에 남음"은 로컬 존재로 충족하고, 커밋되는 과정 기록은 사람이 쓰는 `trace.md`.
- **되돌림 없음** — 설계대로 진행.
