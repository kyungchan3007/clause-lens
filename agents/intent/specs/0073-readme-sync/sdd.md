# SDD — README 프로젝트 현황·로드맵 최신화

- **관련 PRD**: 0073-readme-sync/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)
TASKS.md를 단일 출처로 삼아 README의 상태 서술 블록만 치환한다. 대상은 ① 프로젝트 현황(업데이트 날짜·배너·요약표·기능별 상태표), ② 핵심 기능의 "예정" 문구, ③ 개발 로드맵 표. 설계·흐름·스택 서술은 건드리지 않는다.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 상태 블록만 최소 치환 | 안전·리뷰 쉬움·설계문서 보존 | 한 번 더 수작업 동기화 필요 | ✅ |
| B. 현황을 TASKS.md에서 자동 생성 | 재동기화 불필요 | 과설계(스크립트·포맷 계약), 범위 초과 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 파일/모듈: `README.md` (프로젝트 현황·핵심 기능·개발 로드맵 섹션)
- 새 의존성: 없음
- 상태: 문서 전용, 런타임 상태 경계 영향 없음

## 4. 데이터 / 계약 (Contracts)
API/계약 변경 없음. 상태 표기는 TASKS.md 행을 그대로 반영.

## 5. 위험과 완화 (Risks)
- R1. 표가 또 금방 낡는다 → 완화: 업데이트 날짜 명시, 상태 출처를 TASKS.md로 고정(본 SDD에 명시).
- R2. 표기 오류로 실제와 불일치 → 완화: Acceptance에서 TASKS.md 대조.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 커밋. 문제 시 커밋 revert로 즉시 원복.

## 7. 검증 (Verification)
- TASKS.md와 README 현황/로드맵을 항목별 대조.
- `bash agents/harness/evals/checks.sh` PASS 확인.
