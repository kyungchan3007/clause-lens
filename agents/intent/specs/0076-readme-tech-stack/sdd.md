# SDD — README 기술 스택 섹션 추가

- **관련 PRD**: 0076-readme-tech-stack/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)
`README.md`의 `## 🗂️ 모노레포 구조` 섹션 끝과 `## 🔄 이렇게 돌아갑니다` 사이에 `## 🧰 기술 스택` 섹션을 삽입한다. 계층(앱 · 스타일링 · 서버·워커 · 공용 · 개발)별 2열 표. 목차 줄에 `[기술 스택](#-기술-스택)`을 추가한다.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 모노레포 구조 다음에 신설 섹션 | 구조 직후라 자연스러움·상단 포커스 유지 | 섹션 1개 증가 | ✅ |
| B. 개발 환경 표를 확장 | 섹션 수 유지 | 환경(버전)과 스택이 섞여 가독성↓ | ❌ |
| C. 상단 뱃지만 추가 | 가장 가벼움 | NativeWind·Zustand 등 세부 안 보임 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 파일: `README.md`(목차 1줄 + 섹션 1개 추가)
- 코드·의존성 변경 없음

## 4. 데이터 / 계약 (Contracts)
변경 없음(문서).

## 5. 위험과 완화 (Risks)
- R1. 라이브러리 목록 부정확 → 완화: `apps/*/package.json` 대조. 검증은 zod(class-validator 미사용), 위험 조항 분석은 Claude(@anthropic-ai/sdk), 이미지 처리 sharp, presign AWS S3 SDK 반영.
- R2. 목차 앵커 불일치 → 완화: 기존 목차 패턴(`#-핵심-설계`)과 동일 규칙으로 `#-기술-스택`.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 커밋(README). 문제 시 revert.

## 7. 검증 (Verification)
- README 렌더에서 기술 스택 표가 그룹별로 보임.
- `bash agents/harness/evals/checks.sh` ALL PASS.
