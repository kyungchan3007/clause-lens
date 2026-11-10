# SDD — README 포트폴리오용 재구성

- **관련 PRD**: 0085-readme-portfolio/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)
`README.md`를 사용자 초안으로 교체하고, 경고 문구 아래에 `## 📌 해결한 문제`(번호 3줄)를 추가한다. `## 🎯 핵심 기술`은 초안 내용을 유지하되 순서를 동시성 → 좌표 → 비동기로 바꾸고, 동시성에 "검증 중 중복 차감 버그 발견·수정"과 "확장", 비동기에 "흐름"·"한 트랜잭션" 문장을 보강한다. 아키텍처 mermaid를 `docs/images/architecture.png`로 교체한다(원본 SVG/HTML `architecture.source.html` 함께 보관, Chrome headless 2x 렌더).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 요약 3줄 + 핵심 기술 1:1 상세 | 첫 화면 스캔·상세 연결 | 섹션 1개 증가 | ✅ |
| B. 핵심 기술을 "배운 점" 글로 교체 | 이야기 강함 | 수치·링크 손실, 내부 용어 | ❌ |
| C. mermaid 유지 | 텍스트로 수정 쉬움 | 렌더 품질 불균일, 사용자 금지 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- 파일: `README.md`, `docs/images/architecture.png`, `docs/images/architecture.source.html`
- 코드·의존성 변경 없음

## 4. 데이터 / 계약 (Contracts)
변경 없음(문서).

## 5. 위험과 완화 (Risks)
- R1. 수치 과장 → 완화: 초안·JOURNAL(#90 통합 테스트, consumed=2 버그 수정) 기존 수치만 사용.
- R2. 깨진 이미지 → 완화: 존재하지 않는 스크린샷 3장은 주석 처리.
- R3. 깨진 링크 → 완화: `agents/context/*`·`agents/harness/README.md` 경로 존재 확인.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 PR. 문제 시 revert.

## 7. 검증 (Verification)
- 이미지 렌더 육안 확인(겹침·잘림 없음).
- 링크 경로 존재 확인 스크립트.
- `bash agents/harness/evals/checks.sh` ALL PASS.
