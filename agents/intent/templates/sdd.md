# SDD — <기능 이름>

> 복사해서 스펙 파일 안 "설계" 섹션으로 쓰거나 별도 저장. "어떻게 만드는가".

- **관련 PRD**: NNNN-슬러그.md
- **상태**: draft | approved

## 1. 접근 방식 (Approach)
선택한 구현 방향 요약.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A |  |  | ✅/❌ |
| B |  |  | ✅/❌ |

## 3. 영향받는 코드 (Touched Surface)
- 파일/모듈: `app/...`, `components/...`
- 새 의존성: (있다면 — Expo v57 호환 확인 필수)
- 상태: 클라이언트 Draft vs 서버 기준 상태 경계 → [architecture.md](../../context/architecture.md)

## 4. 데이터 / 계약 (Contracts)
API 요청·응답 형태, 좌표/revision 등 서버와의 계약. README의 JSON 예시 형식을 따른다.

**BFF 트리거 체크** (새 API/외부 연동을 추가하는 작업일 때만): 다른 클라이언트·다중 서비스 조합·계약 분기 중 하나라도 YES인가? → 대개 NO, **NestJS 엔드포인트로 해결**. 자세한 트리거·판단은 [architecture.md § BFF는 두지 않는다](../../context/architecture.md).

## 5. 위험과 완화 (Risks)
- R1 → 완화:

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
어떻게 배포하고, 문제 시 어떻게 되돌리는가.

## 7. 검증 (Verification)
어떤 [Eval](../../harness/evals/README.md)/수동 확인으로 이 설계가 맞는지 증명하는가.
