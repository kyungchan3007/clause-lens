# 공유 저널 (Shared Journal) — append-only

> 두 AI(Claude, Codex)의 작업 로그. **최신 항목을 맨 위에 추가**합니다.
> 남의 항목은 수정·삭제하지 않습니다. 형식은 [observability.md](harness/observability.md) 참고.
>
> ```md
> ## YYYY-MM-DD HH:MM · <Claude|Codex> · #TASK-xxx
> - **무엇**: …
> - **왜**: …
> - **파일**: …
> - **게이트**: PASS/FAIL
> - **다음/주의**: …
> ```

---

## 2026-08-17 22:55 · Codex · #OPS-ISSUE-STYLE-RULES
- **무엇**: GitHub 이슈 초안 정리 지침에 명사형 종결 문체 규칙과 `커밋메시지(한글)` 동반 출력 규칙을 추가.
- **왜**: 이슈 초안과 커밋 메시지 문체를 더 일관되게 유지하고, 사용자가 바로 복붙해 쓸 수 있는 형태로 맞추기 위해.
- **파일**: `agents/harness/github-issue-templates.md`
- **게이트**: ✅ PASS (`bash agents/harness/evals/checks.sh`)
- **다음/주의**: feature 요청이라도 실제 diff가 fix/refactor 성격이면 그 점을 한 줄로 명시하되, 본문 문체는 계속 명사형으로 유지.

## 2026-08-17 22:48 · Codex · #OPS-ISSUE-DRAFT-RULES
- **무엇**: 사용자가 `feat/refactor/fix/style/docs/deploy 템플릿으로 정리해줘`라고 요청했을 때, 변경된 코드 기준으로 GitHub 이슈 초안을 작성하는 운영 지침서를 추가.
- **왜**: 혼자 작업할 때 diff를 다시 읽어 이슈 문장을 수동 작성하는 비용을 줄이고, 템플릿 출력 형식을 일관되게 유지하기 위해.
- **파일**: `agents/harness/github-issue-templates.md`, `agents/harness/README.md`, `AGENTS.md`
- **게이트**: ✅ PASS (`bash agents/harness/evals/checks.sh`)
- **다음/주의**: 템플릿 요청이 실제 diff 성격과 달라도 사용자가 지정한 종류를 우선하되, 어긋남은 한 줄로 명시한다.

## 2026-08-17 22:40 · Codex · #OPS-ISSUE-TEMPLATES
- **무엇**: GitHub 저장소용 이슈 템플릿 6종(`feature`, `refactor`, `fix`, `style`, `docs`, `deploy`)과 기본 설정 파일을 추가.
- **왜**: 혼자 작업하더라도 이슈 입력 형식을 고정해 PR/작업 단위를 분류하고 기록 품질을 올리기 위해.
- **파일**: `.github/ISSUE_TEMPLATE/config.yml`, `.github/ISSUE_TEMPLATE/*.yml`
- **게이트**: ✅ PASS (`bash agents/harness/evals/checks.sh`)
- **다음/주의**: 라벨은 GitHub 저장소에 미리 만들어두면 템플릿의 `labels` 값이 바로 적용된다.

## 2026-08-17 · Claude · 결정: BFF 미채택(트리거 재검토)
- **무엇**: 앱↔NestJS 사이 별도 BFF 계층을 두지 않기로 결정. 재검토 트리거 + 3층 캐싱 정책을 architecture.md에 기록, SDD 템플릿에 체크포인트 추가.
- **왜**: 요청 수·비용 걱정은 BFF로 안 풀림(요청은 기기에서 나감, BFF는 원본 부하만 감소). 앱 복귀는 메모리 캐시(TanStack Query)로 공짜, 콜드스타트는 persist, 서버부하는 NestJS 내부 캐시로. NestJS가 이미 BFF 역할. 데이터가 사적·개인별·미리계산이라 서버 공유 캐시 효율도 낮음.
- **정책**: 기본값 "안 만듦". 새 기능/API 연동 시 트리거 3개(다른 클라이언트/다중 서비스 조합/계약 분기) 검토, YES라도 NestJS 엔드포인트 우선, 그래도 안 되면 별도 서비스.
- **파일**: `agents/context/architecture.md`(§BFF는 두지 않는다), `agents/intent/templates/sdd.md`(§4 BFF 트리거 체크)
- **게이트**: 문서만 변경.
- **다음/주의**: 클라 데이터 계층은 TanStack Query(서버 캐시·staleTime·persist) + Zustand(Draft)로 확정 방향. entitlement는 서버 최종 기준 유지.

---

## 2026-08-17 · Claude · 도메인·기능 가이드 통합
- **무엇**: 사용자 제작 가이드 16개를 아키텍처에 통합. 도메인 6 + domain-map → `context/`(flat), 기능 6 → `intent/features/`. INSTALL.md·중복 README 2개는 폐기(알맹이만 흡수).
- **왜**: 추상 아키텍처와 작업 스펙 사이의 "도메인 모델 + 기능 정의" 중간층 공백을 채움.
- **배치 결정(논쟁으로 확정)**: 계층 = 동사 하나. **feature=정의한다→Intent**(Harness는 기능-불문 기계장치라 per-feature 파일 불가), **domain=안다→Context**. Intent가 배제하는 건 엔지니어링 how이지 행동 how가 아님 → PRD 템플릿 문구 정정.
- **파일**: `AGENTS.md`, `agents/README.md`(동사 판별표+배치원칙), `agents/context/*`(도메인 6+domain-map, README·architecture 링크), `agents/intent/README.md`(features 인덱스), `agents/intent/features/*`(6), `agents/intent/templates/prd.md`, `agents/intent/specs/0001`(feature 참조), `agents/harness/loop.md`(충돌 우선순위+완료조건), `agents/harness/guardrails.md`(민감정보 로그 금지), `agents/orchestration/TASKS.md`(스펙 공백→feature 연결, TASK-007 추가)
- **게이트**: 문서만 변경, 앱 코드 무변경 → typecheck 영향 없음(직전 PASS 유지).
- **다음/주의**: context는 flat 유지(도메인 서브디렉터리 만들지 말 것, domain-map이 유일 인덱스). 기능 구현 착수 전 `intent/features/<기능>` → `context/domain-map` → 관련 도메인 문서 순서로 읽을 것.

---

## 2026-08-17 · Claude · 게이트 최초 PASS
- **무엇**: 완료 게이트(`checks.sh`)를 최초로 초록으로 만듦. Typecheck + expo-doctor 모두 PASS.
- **왜**: 게이트가 완료 판정 기준이므로 실제로 통과 가능한 상태여야 함.
- **파일**: `package.json`/lock(@types/react 추가, expo-constants·expo-router 패치 정렬), `components/iridescence.tsx`(셰이더 null 타입 버그 수정), `agents/harness/evals/checks.sh`(expo-doctor는 `pnpm dlx`로 호출)
- **게이트**: ✅ PASS (Typecheck 21/21, expo-doctor 21/21)
- **다음/주의**: `Skia.RuntimeEffect.Make`는 `SkRuntimeEffect | null` 반환 → 이 tsc(6.0.3)는 module-const narrowing이 클로저로 전파 안 됨. 명시적 타입 바인딩(`const source: SkRuntimeEffect = compiledShader`)으로 처리. 유사 셰이더 코드에서 동일 패턴 사용할 것. `pnpm-workspace.yaml`에 `minimumReleaseAgeExclude` 항목이 자동 추가됨(expo install 부작용).

---

## 2026-08-17 · Claude · 아키텍처 스캐폴드
- **무엇**: 에이전틱 엔지니어링 아키텍처(Intent/Context/Harness/Orchestration + Verification 직교축)를 `AGENTS.md` + `agents/` 트리로 구축.
- **왜**: Claude와 Codex 두 AI가 동일한 규칙·단일 진실 소스로 협업하기 위함.
- **파일**: `AGENTS.md`, `agents/**` (README·intent·context·harness·orchestration·evals/checks.sh·JOURNAL)
- **게이트**: 문서 스캐폴드라 앱 코드 변경 없음. `checks.sh`는 실행 가능 상태로 제공.
- **다음/주의**: 두 AI 모두 작업 시작 전 `AGENTS.md → agents/README.md`를 읽고, `TASKS.md`에서 태스크를 CLAIM할 것. 첫 실제 작업 후보는 TASK-001(스펙 0001 존재).
