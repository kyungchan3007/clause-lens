# Intent Engineering — "무엇을 만드는가"

에이전트가 코드를 쓰기 전에 **의도를 명확히 고정**하는 계층입니다.
모호한 지시("업로드 기능 만들어줘")를 검증 가능한 정의로 바꿉니다.

> **계층 판별**: Intent는 **정의한다(define)**. 무엇을 만들 것인가 — 기능·작업의 정의, 경계, 수용조건.
> 배제하는 건 **엔지니어링 how**(어떤 라이브러리·함수)이지, **행동 how**(사용자 흐름·필수 상태·실패 처리)가 아닙니다.
> 행동 흐름은 정당한 Intent 내용입니다.

## Intent의 3종 산출물

| 산출물 | 성격 | 위치 |
| --- | --- | --- |
| **features** | **상시(evergreen) 기능 정의** — "이 기능은 이렇게 동작해야 한다"의 경계·흐름·수용조건 | [`features/`](features/) |
| **specs** | **작업 단위 스펙** — 특정 작업의 무엇/왜 + 설계 결정(SDD) + AC. feature 정의를 참조 | [`specs/`](specs/) |
| **templates** | 위 문서를 쓰기 위한 틀 | [`templates/`](templates/) |

**features vs specs**: feature는 기능의 *상시 정의*(변하지 않는 계약), spec은 그 기능을 향한 *한 조각의 작업*(번호가 붙고, 설계 결정을 담음). 스펙은 관련 feature를 참조하고 그 위에 작업 델타를 얹습니다. 많은 태스크는 feature 정의만으로 충분하며, 별도 설계 판단이 필요할 때만 spec을 추가합니다.

## 기능(features) 인덱스

| 사용자 기능 | 정의 문서 | 관련 도메인 |
| --- | --- | --- |
| 사진 촬영·불러오기 | [capture-import.md](features/capture-import.md) | Document, Upload |
| 분석하기 | [analyze-document.md](features/analyze-document.md) | Entitlement, Document, Analysis, Clause |
| 특정 페이지 교체 | [replace-page.md](features/replace-page.md) | Document, Upload, Analysis |
| 결과·하이라이트 보기 | [view-highlights.md](features/view-highlights.md) | Clause, Highlight |
| 로그인·구독 상태 | [login-entitlement.md](features/login-entitlement.md) | Auth & Entitlement |
| 저장·보관하기 | [save-retain.md](features/save-retain.md) | Entitlement, Document, Upload |

> 각 feature의 도메인 계약·불변조건은 [context/domain-map.md](../context/domain-map.md) → 도메인 문서를 참조.

## 문서 작성 규칙

### 템플릿 (작업 단위)
| 문서 | 답하는 질문 | 템플릿 |
| --- | --- | --- |
| **PRD** | 왜 · 누구를 위해 · 성공은 무엇 | [templates/prd.md](templates/prd.md) |
| **SDD** | 어떻게 만드는가(엔지니어링) · 대안·트레이드오프 | [templates/sdd.md](templates/sdd.md) |
| **Acceptance Criteria** | 무엇이 만족되면 "됐다"인가 | [templates/acceptance-criteria.md](templates/acceptance-criteria.md) |

작은 태스크는 PRD/SDD 없이 Acceptance Criteria만으로 충분:
- **UI 미세 조정, 버그 수정** → Acceptance Criteria만
- **새 화면·새 API 연동·상태 흐름 변경** → PRD 요약 + SDD + AC

### specs 규칙
1. `NNNN-슬러그.md` (4자리 번호 + kebab-case)로 [`specs/`](specs/)에 저장.
2. 번호는 단조 증가.
3. 모든 스펙은 **Acceptance Criteria(체크박스)** 포함 — [Eval](../harness/evals/README.md)·완료 판정의 기준.
4. 스펙 하나 = [작업 보드](../orchestration/TASKS.md)의 태스크 하나 이상에 연결.

## 피드백 루프

[Eval](../harness/evals/README.md)·[저널](../JOURNAL.md)에서 정의가 현실과 어긋난 게 드러나면,
**코드가 아니라 정의(feature/spec)를 먼저 고칩니다.** Intent 문서는 살아있는 문서입니다.

## 예시

- 상시 기능 정의: [features/capture-import.md](features/capture-import.md)
- 작업 단위 스펙: [specs/0001-image-capture-and-draft.md](specs/0001-image-capture-and-draft.md) (capture 기능의 첫 구현 태스크)
