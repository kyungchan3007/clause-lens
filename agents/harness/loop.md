# Loop Engineering — 작업 루프

두 AI 모두 태스크 하나를 아래 절차로 처리합니다. 도구는 달라도 절차는 동일합니다.
**이 루프는 선형이 아니라 순환입니다** — 마지막 `REFLECT`가 결과를 Intent·Context로 되먹여 다음 루프를 개선합니다. REFLECT가 빠지면 "한 번 세팅으로 끝나는 죽은 구조"로 회귀합니다.

```
1. CLAIM      TASKS.md에서 owner=나, status=in-progress
2. DEFINE ★   spec 파일 `intent/specs/NNNN-슬러그.md` 생성 → PRD 섹션(왜/무엇 + Acceptance) 작성. 연결된 intent/features·기존 specs 확인.
3. CONTEXT    architecture → domain-map → 관련 도메인 문서 + frontend-architecture. (UI면 **shared/domain 위치 먼저 판단**[§공유 UI 승격, shared-first] + ui-ux-pro-max 스킬 조회) 관련 코드만.
4. PLAN ★     같은 spec 파일에 SDD 섹션 작성(**무조건**): 접근·**대안·트레이드오프**·파일계획·검증계획. → 구현 전 게이트(아래 §4). 위험한 작업이면 사용자 승인.
5. BUILD      Guardrails 지키며 작게 구현. Expo 코드면 v57 문서 먼저.
6. GATE       bash agents/harness/evals/checks.sh → PASS까지 반복. 계속 실패하면 §6(막힘·실패·롤백).
7. VERIFY ★   Acceptance 확인 + **단위 테스트·e2e 테스트를 무조건 작성·실행**(→ 아래 §테스트 필수, 필요시 시나리오 추가). 필요시 시뮬레이터. **결과를 spec의 SDD §검증에 채운다.**
8. RECORD     JOURNAL.md append(무엇/왜/파일/게이트/**이번에 드러난 공백**/다음), TASKS.md status=done.
9. REFLECT ★  이번 태스크가 드러낸 규칙·스펙·문서 공백을 Intent(spec/feature)·Context(문서)에 반영 → 루프를 닫는다(§9).
```

## §4. 구현 전 게이트 — SDD/PRD 필수 (코드보다 먼저)

**모든 태스크는 착수 시 spec 문서(`intent/specs/NNNN-슬러그.md`)를 남긴다. 문서 없이는 BUILD 금지.** — [guardrails](guardrails.md)로 강제.
채팅에만 남기지 말고 **파일로 영구화**한다: 결과물(코드)은 사용자가 보지만 **과정(왜·대안·근거)** 은 문서로만 남는다. JOURNAL은 사후 결과 로그라 과정을 담지 못한다 → 그 자리가 SDD/PRD.

spec 파일 한 개에 아래를 담는다 (기능/chore 동일 형식, 템플릿: [prd](../intent/templates/prd.md) · [sdd](../intent/templates/sdd.md)):

- **PRD 섹션(왜/무엇)** — 문제·목표·비목표·사용자 흐름·제약·Acceptance. (사소한 chore는 얇게)
- **SDD 섹션(어떻게)** — ① 읽은 문서 ② 접근 ③ **고려한 대안·트레이드오프**(예: 오늘 pnpm overrides 논쟁이 여기 남았어야 함) ④ 파일·순서 계획 ⑤ 위험 ⑥ 검증 계획. **대안·검증은 chore도 필수.**

→ 이 문서 없이 코드 작성 금지. (큰/되돌리기 어려운 작업이면 여기서 **사용자 승인**까지.) VERIFY 후 검증 결과를 이 문서에 채운다.
**역할 분리**: SDD/PRD = 사전·과정·근거 / JOURNAL = 사후 결과 로그.

## §6. 막힘·실패·롤백

- **게이트가 계속 FAIL** 하거나 원인 불명확: 무리한 우회(`@ts-ignore` 남발·검사 약화) **금지**. 원인 진단 우선.
- **AC를 못 맞추거나 막히면**: TASKS.md status를 **`blocked`** 로 바꾸고 **이유를 JOURNAL에 기록**, 사용자에게 표면화. **"done" 절대 금지.**
- **의도가 자꾸 어긋나면**: 코드가 아니라 스펙이 틀린 것 → DEFINE으로 돌아가 spec/feature를 고친다(= REFLECT).
- **롤백**: 태스크 브랜치라 안전. 커밋 전이면 `git restore .`, 브랜치째 폐기 가능. 커밋 후 되돌리기는 **사용자 확인 후** `git revert`. (되돌리기 어려운 작업은 애초에 승인 후 진행.)

## §테스트 필수 — 단위 + e2e (매 태스크, 무조건)

**코드를 바꾸는 태스크는 완료 시 반드시 단위 테스트 + e2e 테스트를 남기고 실행한다.** "기능 하나 완료될 때"가 아니라 **매 태스크마다** (SDD/PRD-always와 같은 위상의 필수 규칙). 문서 전용 태스크는 해당 없음.

- **단위 테스트**: 새/변경 로직에 작성. api `src/**/*.spec.ts`(Jest), mobile `src/**/*.test.ts`(jest-expo). `checks.sh` 게이트가 실행.
- **e2e 테스트**: 화면 흐름은 `apps/mobile/.maestro/`(SCENARIOS.md + Maestro `*.yaml`). **기존 시나리오로 안 덮이면 시나리오를 새로 추가**해서 커버를 넓히고 진행한다.
- 자동화 불가 부분(카카오 자격증명 등)은 **수동 단계로 명시**하고 관측 결과를 JOURNAL에.
- **테스트 없이 "done" 금지.** 게이트(단위)는 자동, e2e 시나리오는 최소 문서화+가능 범위 실행.

## §7. PR 리뷰 대응 (봇·사람)

PR을 열면 자동 리뷰(봇)·사람 리뷰가 코멘트를 남긴다. 처리 원칙:

- **인라인 코멘트는 "답글 + resolve"까지 닫는다.** 코드만 고치고 스레드를 열어두면 다음에 계속 눈에 걸린다. 조치한 코멘트마다 스레드에 한 줄 답글(무엇을 바꿨는지) 후 resolve.
- **false-premise(전제가 틀린) 지적은 근거 대고 반려한다** — "아닌건 아니다". 예: `EXPO_PUBLIC_*`는 빌드 시 인라인되므로 "런타임 미보장"은 성립 안 함 / Jest는 파일별 격리라 "테스트 간 누수"는 성립 안 함. **무한 대응 금지**: 실질(버그·회귀·보안·명확한 개선)만 반영하고, 투기적/메타 지적은 근거와 함께 닫는다.
- **수정→그 수정에 또 지적** 루프가 돌면 실질만 반영하고 나머지는 반려로 끊는다. 리뷰어를 만족시키려 코드를 계속 바꾸지 않는다.
- 리뷰로 실제 코드를 고쳤으면 §6 게이트 재통과 후 push. 커밋·푸시는 사용자 요청/Auto-fix 권한 범위에서.

## §9. REFLECT — 피드백 루프 (완료의 일부)

RECORD로 끝이 아니다. 이번 태스크에서 **게이트·검증·구현이 드러낸 것**을 되먹인다:

- 규칙/경계가 애매하거나 빠졌으면 → [guardrails](guardrails.md) · [frontend-architecture](../context/frontend-architecture.md) 갱신.
- 스펙이 현실과 어긋났으면 → 코드가 아니라 **spec/feature를 먼저** 고친다.
- 도메인 지식이 바뀌었으면 → [domain-map / 도메인 문서](../context/domain-map.md) 갱신.
- 반복되는 실수(예: 특정 API 오용, 환경 함정)면 → 관련 Context/Environment 문서에 "주의"로 추가.

상세 원리: [observability § 피드백 루프](observability.md#피드백-루프-연결). **되먹임이 이 아키텍처를 살아있게 한다.**

## 문서 충돌 우선순위

여러 문서가 부딪히면: **Guardrails(안전) → 승인된 Intent(spec > feature 정의) → Context 도메인 계약**.
단, spec이 **안전 Guardrail이나 도메인 불변조건을 어기라**고 하면 따르지 말고 **멈춰 확인**한다 —
대개 문서가 낡았다는 신호이므로 [피드백 루프](observability.md#피드백-루프-연결)로 정정한다(REFLECT).

## 원칙

- **작게 반복한다.** 한 번에 하나의 논리적 변경 → 게이트 → 다음. 거대한 배치 커밋 금지.
- **코드 전에 SDD/PRD를 파일로 남긴다(§4).** 문서 없이 BUILD 금지. 게이트 없이 완료 선언 금지 — `checks.sh` PASS 아니면 "됐다" 안 한다.
- **막히면 스펙으로 돌아간다.** 구현이 자꾸 어긋나면 코드가 아니라 의도가 틀린 것 → `blocked` + REFLECT.
- **불확실하면 멈추고 묻는다.** 되돌리기 어려운 것(파일 삭제, 커밋·푸시·PR, 외부 전송, 설정 변경)은 확인 먼저.
- **완료는 REFLECT까지.** 배운 걸 문서에 되먹이지 않으면 미완이다.

## 자기 점검 (완료 전 체크)

- [ ] **§4 spec 문서(SDD/PRD)** 를 코드 전에 파일로 남겼나? (대안·검증 포함)
- [ ] Acceptance(feature Checklist / spec AC) 전부 충족?
- [ ] `checks.sh` PASS? (실패면 `blocked` 처리했나?)
- [ ] (코드 태스크면) **단위 테스트 + e2e 테스트**를 작성·실행했나? 필요한 시나리오 추가했나? (§테스트 필수)
- [ ] [Guardrails](guardrails.md) 위반 없음? (UI면 ui-ux-pro-max 조회했나?)
- [ ] UI면 **shared-first** 위치 판단했나? 도메인 결합 아닌 제네릭 UI는 `packages/ui`에 만들었나? ([frontend-architecture](../context/frontend-architecture.md#공유-ui-승격-기준-packagesui--shared-first))
- [ ] 변경한 코드의 책임이 **하나의 도메인**으로 설명되나? ([domain-map](../context/domain-map.md))
- [ ] 도메인 경계를 넘는 데이터는 명시적 타입/API 계약을 쓰나?
- [ ] 서버 상태와 클라이언트 Draft를 **혼합 저장**하지 않았나?
- [ ] 로딩·빈 상태·실패·재시도·성공 상태가 정의됐나?
- [ ] 로그에 이미지 원문·OCR 전문·토큰·Presigned URL을 남기지 않았나?
- [ ] 상대 AI가 점유한 파일을 건드리지 않았나? ([TASKS.md](../orchestration/TASKS.md))
- [ ] [JOURNAL.md](../JOURNAL.md) 기록 완료?
- [ ] **§9 REFLECT** — 이번 태스크의 학습을 Intent/Context에 반영했나?
