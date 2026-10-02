# 0057 — 과정 기록 (trace)

## 판단
- **왜 이식 후 깨졌나(근본 분석).** 이식 2/4(#83)에서 만든 체크박스 도구는 spec을 **단일 파일**(`listSpecs`→`NNNN-슬러그.md`)로 가정했다. 이식 3/4(#84)에서 spec을 **폴더형**(`prd/sdd/trace`)으로 바꾸며 `listTaskFolders`/`folderForIssue`/`readFolderFile`을 추가했지만, 동기화·검사 쪽(`specForIssue`·`inspectIssueRecords`·`replaceIssueAcceptance`)은 단일 파일 경로만 보도록 남겨졌다. 그래서 0025+ 폴더형 태스크 전부에서 도구가 조용히 무력화됐다(측정: 이식 후 방치 19개 전부 폴더형).
- **수정 기준 1 — 가드 회귀 금지.** `specForIssue`를 폴더형까지 매칭하도록 넓히면, `decideEdit`/`checkBeforeStop`이 폴더형 태스크를 "도입 전 단일 파일(면제)"로 오판해 prd/sdd/trace 강제를 우회한다. 그래서 `specForIssue`는 단일 파일 전용으로 두고, 해석 전용 `acceptanceSourceForIssue`를 신설해 `issue-sync`만 그것을 쓰게 했다(대안 B 기각).
- **수정 기준 2 — 원본 우선순위.** 단일 파일(0001~0024) 우선, 없으면 폴더형(`prd.md`). 폴더형이면 `prd.md`의 `### Acceptance`가 원본. `name`을 `0057-…/prd.md`로 돌려줘 메시지도 정확.
- **수정 기준 3 — 정규식은 제목만 넓히면 위험.** `### 완료 조건`을 인식하되 끝 경계를 `^## `(단일) 대신 **같은 레벨 이하**(`^#{1,level}[ \t]|^---`)로 바꿔야 뒤따르는 다른 `###` 섹션(과 그 체크박스)을 삼키지 않는다. 이슈 본문의 "착수 전 확인" 경고 그대로 — 뒤에 `###` 있는 본문으로 경계 회귀 테스트를 추가했다. 규칙을 `records.mjs`의 `acceptanceSection`과 일치시켜 읽기(비교)와 쓰기(교체) 경계 의미를 통일.
- **수정 기준 4 — done 게이트 폴더형 포함.** `inspectIssueRecords`의 done 미체크 루프에서 각 `doneSpecIds` id를 단일 파일명 우선, 없으면 폴더(`prd.md`)로 해석. 단일 파일 경로·메시지 형식은 불변(회귀 테스트로 고정).

## 막힘 / 되돌림
- 폴더형 done 미체크 테스트가 처음에 실패. 원인은 코드가 아니라 **테스트 픽스처 문구** — 미체크 항목 텍스트에 "사유"가 들어가 `REASON_MARK`(`사유` 포함)에 걸려 "사유 있는 미체크"로 분류됐다. 픽스처를 "그냥 빠뜨린 항목"으로 바꿔 해결(코드는 정상).
- `specForIssue` broaden안을 잠깐 검토했으나 `decideEdit` 경로 추적에서 폴더형 강제 우회(회귀)를 확인하고 되돌려, 해석 전용 함수 분리로 전환.

## 검증 결과
- `node agents/harness/evals/issue-sync.mjs --check`(폴더형 0057 브랜치): **#153 → `0057-folder-spec-sync/prd.md`(폴더형) 해석 성공** — "가리키는 spec이 없습니다" 오류 0건(결함1 해소). exit 1은 아직 라이브 이슈를 동기화하지 않아 spec≠이슈를 알리는 정상 신호(= `pnpm issue-sync` 실행 안내). 합치기 시점 동기화는 메인 세션 담당(라이브 이슈 본문 미변경).
- `bash agents/harness/evals/checks.sh` **ALL PASS**(전체 게이트). "Task records (folder)"가 폴더 34개 + `현재 이슈 #153` 해석, "Issue·checkbox records" OK.
- 하네스 단위 테스트 59 pass / 0 fail(해당 파일 묶음). 체크박스 관련 3개 파일(records·records.folder·issue-sync) 22→30 tests(+8).
- 추가 테스트: 폴더형 해석(`acceptanceSourceForIssue`)·단일 파일 회귀·폴더형 done 미체크·단일 파일 done 회귀·사유 있는 미체크 통과·`### 완료 조건` 제자리 교체·뒤 `###` 보존(경계 회귀)·뒤 `##` 보존.
