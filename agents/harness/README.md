# Harness Engineering — "어떻게 안전하게 돌리는가"

에이전트 루프를 감싸는 **런타임 기계 장치**입니다. 무엇을 만들지(Intent)와 무엇을 아는지(Context)가 정해진 뒤, 실제로 안전하고 반복 가능하게 실행되게 합니다.

## 구성 요소

| 요소 | 문서 | 한 줄 |
| --- | --- | --- |
| **Loop** | [loop.md](loop.md) | 계획→구현→검증 반복 절차 |
| **Tool / Environment** | [environment.md](environment.md) | 명령·도구·환경 설정 |
| **Issue Templates** | [github-issue-templates.md](github-issue-templates.md) | 변경된 코드 기준으로 GitHub 이슈 템플릿 초안 작성 |
| **Eval** *(검증축)* | [evals/README.md](evals/README.md) | 완료 판정 게이트 |
| **Observability** *(검증축)* | [observability.md](observability.md) | 저널·로그로 무슨 일이 있었는지 남김 |
| **Guardrails** *(검증축)* | [guardrails.md](guardrails.md) | 해도 되는 것 / 절대 안 되는 것 |

> Eval·Observability·Guardrails는 물리적으로 여기 있지만 개념상 **Verification 직교축**입니다
> (모든 계층을 검증). 자세한 이유는 [agents/README.md](../README.md#계층-구조).

## 한 장 요약

```
        ┌─ Guardrails: 하지 말아야 할 일을 막는다 (사전)
Loop ───┼─ Tool/Env:  일할 수 있게 한다
        ├─ Eval:      끝났는지 판정한다 (사후 게이트)
        └─ Observability: 무슨 일이 있었는지 남긴다 (사후 기록)
```
