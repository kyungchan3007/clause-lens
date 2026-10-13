# SDD — README 재구성

- **관련 PRD**: 0074-readme-restructure/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)
정보 구조(IA)를 다시 짠다. 상단에 "핵심 설계" 섹션을 신설해 4블록을 중점 순서로 배치하고(각 블록 = 짧은 설명 + 깊이 링크), 기존의 길고 중복된 상세 서술(책임분리 bullet·여러 sequence/flow 다이어그램)은 핵심 1개만 남기고 agents/context 문서로 링크 위임한다. 현황·핵심기능·모노레포 구조·실행·로드맵은 유지하되 간결화한다.

상단 블록 ↔ 링크 대상:
- ① 서버 권위 비동기 파이프라인 → `agents/context/backend-architecture.md`, `agents/context/analysis-job.md`, `agents/context/highlight-rendering.md`
- ② 에이전틱 하네스 → `agents/README.md`, `agents/harness/README.md`
- ③ 보관·삭제 상태 머신 → `agents/context/domain-map.md`, `agents/intent/specs/0068·0069`
- ④ 디자인 시스템·FSD → `agents/context/architecture.md`, `agents/context/frontend-architecture.md`

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 얇은 README + context 링크 위임 | 리뷰어 빠른 파악·유지보수 쉬움·중복 제거 | 깊은 내용 보려면 이동 | ✅ (사용자 선택) |
| B. 한 파일 + `<details>` 접기 | 한 페이지 유지 | 여전히 길고 접힘 상태 관리 번거로움 | ❌ |
| C. 현행 유지 | 작업 없음 | 문제 그대로 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 파일/모듈: `README.md` (전면 재구성). 링크 대상 `agents/context/*`, `agents/*/README.md` 는 **읽기만**.
- 새 의존성: 없음
- 상태: 문서 전용, 런타임 영향 없음

## 4. 데이터 / 계약 (Contracts)
API/계약 변경 없음. 상태·수치는 TASKS.md(및 #188 결과)를 그대로 반영.

## 5. 위험과 완화 (Risks)
- R1. 링크가 실제 파일과 안 맞아 깨짐 → 완화: 작성 후 상대경로 링크를 파일 존재로 검증.
- R2. 축약하다 핵심 정보 유실 → 완화: 지운 상세는 삭제가 아니라 context 문서로 위임(링크 보존).

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 커밋(README 교체). 문제 시 revert로 즉시 원복. 내용 변경이 없어 되돌림 비용 낮음.

## 7. 검증 (Verification)
- 상단 4블록·중점 순서 육안 확인.
- 내부 링크 전수 존재 검증(스크립트로 상대경로 파일 체크).
- `bash agents/harness/evals/checks.sh` PASS.
