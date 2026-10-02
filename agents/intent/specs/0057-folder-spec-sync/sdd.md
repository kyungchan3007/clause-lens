# SDD — 체크박스 동기화·검사가 폴더형 spec을 찾게

> **관련 PRD:** 0057-folder-spec-sync/prd.md · 상태: draft · 갱신: 2026-10-02

## 1. 접근 방식 (Approach)
이미 존재하는 폴더형 함수(`folderForIssue`/`listTaskFolders`/`readFolderFile`)를 재사용해, 단일 파일과 폴더형을 **한 해석 지점**에서 흡수한다. 가드 세 함수의 단일 파일 전용 의미는 건드리지 않는다.

- **`records.mjs`에 `acceptanceSourceForIssue(projectDir, issue)` 신설** — 단일 파일(`specForIssue`) 우선, 없으면 폴더형(`folderForIssue` → `prd.md`). `{ name, text, kind }` 반환. `issue-sync`가 `specForIssue`+`readSpec` 대신 이걸 쓴다.
- **`specForIssue`는 단일 파일 전용으로 유지** — `decideEdit`/`checkBeforeStop`이 "도입 전 단일 파일 면제" 판정에 쓰므로, 폴더형까지 매칭시키면 폴더형 태스크가 prd/sdd/trace 강제를 **우회**(회귀). 그래서 broaden하지 않고 해석 전용 함수를 분리.
- **`inspectIssueRecords`의 done 미체크 루프에 폴더형 추가** — `doneSpecIds`의 각 id를 단일 파일명 우선, 없으면 폴더(`prd.md`)로 해석해 검사. 단일 파일 경로·메시지 형식 불변.
- **`replaceIssueAcceptance` 재작성** — 제목 매칭 `^(#{2,3})[ \t]*(?:완료 조건|Acceptance)`, 끝 경계 `^#{1,level}[ \t]|^---`(= `acceptanceSection`과 동일 규칙)로 같은 레벨 이하에서 멈춤 → 뒤 `###` 섹션·그 체크박스 보존.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 해석 전용 `acceptanceSourceForIssue` 신설 + 가드용 `specForIssue`는 단일 파일 유지 | 가드 회귀 없음, 단일 지점 해석, 테스트 쉬움 | 함수 1개 추가 | ✅ |
| B. `specForIssue`를 폴더형까지 매칭하도록 broaden | 함수 재사용 | `decideEdit`/`checkBeforeStop`이 폴더형을 "단일 파일 면제"로 오판 → prd/sdd/trace 강제 우회(회귀) | ❌ |
| C. `issue-sync`에서 `folderForIssue`를 직접 호출(헬퍼 없이) | records 변경 최소 | done 게이트와 해석 로직 중복, 테스트 단위 분산 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 수정: `agents/harness/lib/records.mjs`(`acceptanceSourceForIssue` 추가·`inspectIssueRecords` done 루프 폴더형 확장), `agents/harness/evals/issue-sync.mjs`(`replaceIssueAcceptance` 재작성·해석 함수 교체).
- 테스트: `records.folder.test.mjs`(해석·done 폴더형 +회귀), `issue-sync.test.mjs`(`### 완료 조건` 제자리·뒤 `###` 보존).
- 문서: `agents/harness/branch-and-issue.md`(60행 "단일 파일" 서술 정정).
- 새 의존성: 없음. 앱·서버 영향 없음.

## 4. 데이터 / 계약 (Contracts)
GitHub 이슈 본문의 `완료 조건` 섹션 ↔ spec `### Acceptance`가 원본. 네트워크 계약 변화 없음. **BFF 트리거 체크**: 해당 없음.

## 5. 위험과 완화 (Risks)
- R1 정규식 제목만 넓히면 뒤 `###` 섹션 체크박스 삭제 → 완화: 끝 경계를 같은 레벨 이하로, 뒤 `###` 있는 본문 회귀 테스트.
- R2 `specForIssue` broaden 시 가드 우회 → 완화: broaden 않고 해석 전용 함수 분리(대안 B 기각).
- R3 폴더형 done 검사가 `check-task-records`와 중복 → 완화: 메시지는 중복 가능하나 둘 다 exit 1로 안전, `check-issue-records`를 자기완결로.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 브랜치. 순수 하네스 도구 변경 → 문제 시 revert(앱·서버 무관).

## 7. 검증 (Verification)
- `node agents/harness/evals/issue-sync.mjs --check`를 폴더형 spec(0057) 브랜치에서 실행 → #153 가리키는 spec을 찾음(spec 없음 오류 소거).
- `bash agents/harness/evals/checks.sh` ALL PASS.
- 단위 테스트: 폴더형 해석·폴더형 done 미체크·단일 파일 회귀·`### 완료 조건` 제자리 교체·뒤 `###`/`##` 보존.
