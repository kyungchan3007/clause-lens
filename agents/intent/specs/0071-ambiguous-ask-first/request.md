<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #182

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/182
- 캡처: 2026-10-09

---
## 배경 — harness-lab 실험 결과 (애매한 요청)
- AI가 요청의 빈칸을 추측하면, 의도가 흔하지 않을 때 거의 틀린다
  - 같은 구현을 정답 의도만 바꿔 채점: 흔한 의도 41% → **흔하지 않은 의도 4%** (harness-lab 0030)
- 묻고 → 답 받고 → 이어 가면 의도와 상관없이 맞는다
  - Opus 대화형: 흔한 의도 100% · 흔하지 않은 의도 **100%** (0028·0030)
  - Haiku 대화형: 87%(0027) · 60%(0030) — 핵심 질문(적립 기준 금액)을 놓친 만큼 틀림
- 지시만으로는 가정을 잘 안 남긴다 → **필수 칸**이면 남는다
  - 지시("원문에 없으면 설계 결정이라 표시"): 3번 중 1번만 따름 (0024)
  - prd 필수 칸 강제: 몰래 지어냄 Haiku 평소 95% → 57%, 역할 분리 86% → 24% (0025)
- Opus는 지시 없이도 대부분 묻는다(0026: 3/3) — 하지만 규칙으로 고정돼 있지 않다
- 근거 문서 (커밋 고정)
  - [0025 필수 칸 결과](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/intent/specs/0025-assumption-field/sdd.md)
  - [0028 큰 모델 + 대화형 결과](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/intent/specs/0028-big-model-interactive/sdd.md)
  - [0030 흔하지 않은 의도 결과](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/intent/specs/0030-uncommon-intent/sdd.md)

## ClauseLens 현재 상태 (develop `2dc9035`)
- "요청이 애매하면 구현 전에 묻는다"는 규칙이 없음
  - [loop.md 2. DEFINE](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/harness/loop.md#L8): PRD(왜/무엇 + Acceptance) 작성만
- 폴더형 prd 검사 [`checkFolderPrd`](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/harness/lib/records.mjs#L266-L272): 제목·Acceptance·이슈 번호만 봄
- [prd 템플릿](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/intent/templates/prd.md)
  - 이미 `## 7. 미해결 질문 (Open Questions)` 칸이 있음 (0068 prd도 사용) — 하지만 검사하지 않고, "가정" 표시 규칙도 없음
  - 템플릿은 번호 붙은 1~7 섹션이고 단일 파일 저장 안내가 남아 있음 (harness-lab 템플릿과 모양이 다름)

## 할 일
1. **질문 먼저 규칙** (문서 — loop.md·AGENTS.md 두 곳만)
   - loop.md 2. DEFINE 줄에 추가: 요청에 정해지지 않은 값·용어가 있으면 구현 전에 질문 목록으로 정리해 사용자 답을 받는다
     - 예: 금액 기준(할인 전/후·배송비 포함 여부), 끝수 처리, 등급·상태 판별 방법, 입력 모양
   - AGENTS.md 4. 작업 루프 (요약)에 한 줄
   - "커밋할까요?" 같은 진행 확인은 질문 목록이 아님 — 요구의 빈칸만
   - 받은 답은 아래 칸의 해당 줄을 `(확인됨: 답)`으로 바꿔 남김
2. **기존 7번 칸을 "애매한 곳·가정" 필수 칸으로** (장치)
   - 새 칸을 따로 만들지 않고 템플릿 `## 7. 미해결 질문 (Open Questions)`를 `## 7. 애매한 곳·가정 (Open Questions)`로 바꿈 (칸 중복 방지)
   - 표시는 **괄호 포함**으로 정함: 줄마다 `(가정)` · `(확인 필요)` · `(확인됨: …)` 중 하나
     - 주의: harness-lab 구현([records.mjs 91행](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/harness/hooks/lib/records.mjs#L91))은 괄호 없이 "가정"·"확인 필요" 부분 문자열만 봐서 "가정하지 않음" 같은 줄도 통과함 → 이식할 때 괄호를 요구하게 강화
   - 정말 없으면 `- 없음 — 이유` 한 줄만 (다른 줄과 섞이면 문제)
   - 템플릿 안내 줄은 `(`로 시작하게 쓰고, 검사는 `(`로 시작하는 줄을 빈 칸으로 취급
   - `checkFolderPrd`에서 **도입 번호 이후 spec만** 검사 (기존 `FOLDER_REQUIRED_FROM`·`REQUEST_REQUIRED_FROM`처럼 상수)
   - 참고 구현 (커밋 고정)
     - [checkAssumptions·assumptionSection](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/harness/hooks/lib/records.mjs#L84-L107)
     - [checkPrd에서 호출](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/harness/hooks/lib/records.mjs#L80)
     - [단위 테스트 (vitest 형식)](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/harness/hooks/lib/records.test.mjs#L322-L341)

## 정해 둔 것 (받는 쪽이 고민하지 않게)
- **도입 번호 = 이 작업의 spec 번호** (0070 이후)
  - develop의 마지막 spec은 0068, 진행 중 브랜치 `chore/164-retention-hard-delete`가 0069 사용 중
  - 머지 직전 번호를 다시 확인 (병렬 브랜치가 같은 번호를 잡을 수 있음)
  - 기존 spec(0069 이하)은 면제 → `checks.sh`의 "Task records (folder)" 검사가 깨지지 않음
- **자기 자신에게 먼저 적용됨**
  - 수정 직전 검사(`decideEdit` → `inspectTaskFolder`)와 세션 시작 안내가 같은 검사를 씀
  - 구현하자마자 이 작업의 prd도 검사 대상 → **자기 prd 7번 칸을 먼저 채울 것** (안 채우면 코드 수정이 막힘)
- **테스트 위치·형식**
  - 기존 [records.folder.test.mjs](https://github.com/kyungchan3007/clause-lens/blob/2dc90357255f3b4aeb4f03d6a89370ad3eb144dd/agents/harness/lib/records.folder.test.mjs)에 추가 (`checks.sh` 77행 테스트 목록에 이미 있음)
  - ClauseLens는 `node:test` + `assert/strict` 형식 — harness-lab 테스트(vitest)를 그대로 복사하면 안 됨
- **템플릿 정비 범위:** 7번 칸 이름·안내 줄만. 1~6번 구조와 단일 파일 안내 정비는 범위 밖

## 하지 않을 것
- "확인 필요"가 남으면 완료를 막는 장치 — harness-lab에서 아직 실험 전
- 설계 Opus + 구현 Haiku 분리 — 작은 작업에선 전부 Opus보다 약 1.4배 비쌈 ([0029](https://github.com/kyungchan3007/Harness/blob/b3e1900ef9ae463e149c60beb54227a1f6dd6e78/agents/intent/specs/0029-design-opus-build-haiku/sdd.md))
- 지난 spec 소급 수정
- loop.md·AGENTS.md 외 문서 동기화

## 완료 조건
- [ ] loop.md 2. DEFINE·AGENTS.md 4. 작업 루프에 질문 먼저 규칙 (진행 확인 제외, 답은 `(확인됨: …)`로)
- [ ] 템플릿 7번 칸을 "애매한 곳·가정"으로 + `checkFolderPrd` 검사(도입 번호 이후만, 괄호 표시 요구)
- [ ] `records.folder.test.mjs` 단위 테스트: 칸 없음 · 안내 줄만 · 표시 없는 줄 · 괄호 없는 "가정" 문구 거부 · `(확인됨: …)` 허용 · `없음 — 이유` · 없음+다른 줄 섞임 · 도입 전 번호 면제
- [ ] `bash agents/harness/evals/checks.sh` ALL PASS
- [ ] sdd에 재측정 기준 기록: 적용 후 새 spec 15개 또는 2주 뒤, 지표 = prd 7번 칸의 `(가정)`·`(확인 필요)`·`(확인됨)` 줄 수와 `(확인 필요)` → `(확인됨)` 전환 비율 (재측정은 그때 별도 이슈로 — 이 이슈는 기준 기록까지)

## 착수 전 알아 둘 함정 (harness-lab에서 실제로 겪음)
- 템플릿 안내 줄 안에 "(가정)" 글자가 있으면 **템플릿 그대로도 검사 통과** → `(`로 시작하는 줄은 빈 칸으로 취급
- 칸은 형식만 본다 — AI가 애매하다고 못 느낀 곳은 칸에도 없다
  - 0025: "결제 금액에 배송비가 들어가나"는 6번 모두 칸에 없었음
  - 그래서 1(질문 먼저)과 2(필수 칸)를 **함께** 넣는다
- 형식만 맞춘 줄도 통과한다 (예: "요청에 명시된 값 (가정)" — 실제로는 요청에 없던 값)


## 착수 전 확인 사항 (2026-10-09, 올린 뒤 이슈 전달 확인에서 발견)
- **기준 커밋이 바뀜**
  - 이 이슈를 쓴 뒤 develop이 `d4dd9a7`(PR #181 머지)로 바뀌었고, 0069는 이미 develop에 들어감
  - loop.md·`agents/harness/lib`·templates·AGENTS.md는 그사이 바뀌지 않아 위 링크·행 번호는 그대로 유효
  - 도입 번호 0070 이후는 그대로
- **칸 제목 찾는 규칙을 정해 둠**
  - harness-lab은 `## 애매한 곳·가정` 한 줄과 **정확히 같은** 줄만 찾음 → 그대로 옮기면 `## 7. 애매한 곳·가정 (Open Questions)`를 못 찾아 항상 "칸이 없습니다"
  - 기존 prd는 번호가 다르거나(0063은 `## 8.`) 꼬리가 붙음(0059: `— Codex 설계 토론에서 확정(…)`)
  - → **`## ` + (선택) `숫자. ` + `애매한 곳·가정` + (선택) 아무 꼬리**를 칸 제목으로 인정
- **표시는 줄 끝에 둔다**
  - 안내 줄 판정은 "본문이 `(`로 시작" → 표시를 앞에 쓰면(`- (확인됨: …) 금액 기준`) 안내 줄로 버려짐
  - → 항목은 `- 내용 — 정한 값 (가정)`처럼 **표시를 줄 끝(본문 뒤)** 에. 위 "할 일"의 "해당 줄을 `(확인됨: 답)`으로 바꿔"는 "줄 끝 표시를 `(확인됨: 답)`으로 바꿔"로 읽을 것
- **항목으로 세는 줄**
  - `- ` 또는 `* `로 시작하는 맨 앞 줄만 항목 (번호 목록·들여쓴 하위 줄은 무시)
  - 기존 `- Q1. …` 형식도 줄 끝에 표시만 붙이면 됨
- **테스트는 칸 검사 함수만 따로**
  - develop 템플릿에는 `## Acceptance`·`- **이슈:**` 줄이 없어서, 템플릿 파일 통째로 `checkFolderPrd`에 넣으면 7번 칸 외 이유로도 실패
  - → 칸 검사 함수를 분리해 export하고, 테스트는 그 함수 결과만 봄
