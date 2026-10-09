# SDD — 애매한 요청 대책: 질문 먼저 + "애매한 곳·가정" 필수 칸

- **관련 PRD**: 0071-ambiguous-ask-first/prd.md
- **이슈:** #182 · **설계 근거**: harness-lab 0024~0030
- **상태**: approved

## 1. 접근 방식 (Approach)
문서(질문 먼저 규칙)와 장치(필수 칸 검사)를 함께 넣는다 — 지시만으론 가정을 안 남기고, 칸은 형식만 보므로 둘이 필요.

**① 질문 먼저 규칙(문서)**
- `loop.md` 2. DEFINE: 요청에 정해지지 않은 값·용어가 있으면 구현 전 질문 목록으로 정리해 답을 받는다(예: 금액 기준·끝수·등급 판별·입력 모양). "커밋할까요?"류 진행 확인은 제외. 답은 7번 칸 줄 끝을 `(확인됨: 답)`으로.
- `AGENTS.md` 4. 작업 루프(요약): 한 줄 추가.

**② 필수 칸 + 검사(장치)**
- 템플릿 `## 7. 미해결 질문 (Open Questions)` → `## 7. 애매한 곳·가정 (Open Questions)` + 안내 줄(`(`로 시작).
- `records.mjs`:
  - `ASSUMPTION_REQUIRED_FROM = "0071"`.
  - `assumptionSection(text)`: 제목 `## `+(선택)`숫자. `+`애매한 곳·가정`+(선택)꼬리 매칭, 다음 `## `까지 본문.
  - `checkAssumptions(text)`:
    - 칸 없음 → 문제.
    - 최상위 항목(`- `/`* ` 시작, 들여쓰기 없음)만. 본문이 `(`로 시작하면 안내 줄 → 무시.
    - 유효 항목 0개 → 문제(빈 칸).
    - `없음` 단독(유효 1개이고 `없음`으로 시작) → OK. `없음`이 다른 항목과 섞이면 → 문제.
    - 각 유효 항목은 줄 끝 `(가정)`/`(확인 필요)`/`(확인됨: …)` 필요. 없으면 → 문제("가정" 부분 문자열만으론 통과 금지, 괄호 표시 요구).
  - `checkFolderPrd(text, id)`: `id >= ASSUMPTION_REQUIRED_FROM`이면 `checkAssumptions` 문제 추가.
- 기존 spec(0070 이하)은 면제 → checks.sh "Task records" 안 깨짐. 자기(0071)엔 적용되므로 이 prd 7번 칸 먼저 채움.

**③ 테스트(node:test)** — `records.folder.test.mjs`
- 칸 검사 함수(`checkAssumptions`) 결과만 검증(템플릿엔 Acceptance·이슈 줄 없어 통째 넣으면 다른 이유로 실패).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 질문 규칙 + 필수 칸 함께 | 지시+장치 상호보완 | 둘 수정 | ✅ |
| 지시만 | 코드 無 | 3번 중 1번만 따름 | ❌ |
| 새 8번 칸 신설 | 기존 유지 | 칸 중복 | ❌(7번 재사용) |
| "가정" 부분 문자열 허용(harness-lab 방식) | 단순 | "가정하지 않음"도 통과 | ❌(괄호 표시 요구) |

## 3. 영향받는 코드 (Touched Surface)
- `agents/harness/loop.md`·`AGENTS.md`(질문 먼저 한 줄씩).
- `agents/intent/templates/prd.md`(7번 칸 이름·안내 줄).
- `agents/harness/lib/records.mjs`(`ASSUMPTION_REQUIRED_FROM`·`assumptionSection`·`checkAssumptions`·`checkFolderPrd` 연결).
- `agents/harness/lib/records.folder.test.mjs`(단위).
- 앱·서버 무관.

## 4. 데이터 / 계약 (Contracts)
- 외부 계약 없음. **BFF**: NO.

## 5. 위험과 완화 (Risks)
- R1 템플릿 안내 줄에 "(가정)" 글자 → 그대로 통과 → 안내 줄은 `(`로 시작시켜 빈 칸 취급.
- R2 칸 제목 번호·꼬리 다름 → 정규식에 선택 번호·꼬리.
- R3 자기 적용으로 코드 수정 막힘 → 이 prd 7번 칸 먼저 채움.
- R4 기존 spec 깨짐 → 도입 번호 이후만 검사.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 문서+검사. 되돌리기: `ASSUMPTION_REQUIRED_FROM` 제거/검사 호출 제거, 템플릿 복구.

## 7. 검증 (Verification)
- 단위: `node --test agents/harness/lib/records.folder.test.mjs`(8케이스).
- `checks.sh` ALL PASS(자기 0071 prd가 검사 통과).
- **재측정 기준**: 도입 후 새 spec 15개 또는 2주 뒤, 지표=7번 칸 `(가정)`·`(확인 필요)`·`(확인됨)` 줄 수와 `(확인 필요)`→`(확인됨)` 전환율. 재측정은 그때 별도 이슈.
