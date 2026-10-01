# 0042 — 결과 route 판정 로직 커스텀 훅 분리 — SDD

> **관련 PRD**: prd.md · **이슈:** #119 · **갱신**: 2026-10-02

## 0. 읽은 문서
- frontend-architecture(레이어·import 경계), spec 0041(#118 같은 패턴·widgets 도입), loop.md

## 1. 접근
```
src/widgets/result-source/
  index.ts
  lib/resultSource.ts         isLiveResult · toImageByPageId (순수)
  lib/resultSource.test.ts
  model/useResultSource.ts    스토어 구독 + 판정 → 판별 유니온
  model/useResultSource.test.ts
```
- 반환 타입:
  - `{ kind: "live"; documentId; pages; imageByPageId }` — 방금 분석한 문서(메모리 스냅샷, 이미지 포함)
  - `{ kind: "review"; documentId }` — 그 외 문서(서버 재열람)
  - `{ kind: "none" }` — documentId 없음
- `imageByPageId`는 기존처럼 `useMemo([uploadPages])`로 참조 안정 유지(훅 안).
- route: `useLocalSearchParams` 파싱 → `useResultSource(requestedDocId)` → `kind` 분기 렌더.

## 2. 고려한 대안
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| boolean `isLive` + 개별 값 반환 | 기존 코드와 유사 | route가 다시 조건 조합, live일 때만 유효한 값이 섞임 | ❌ |
| 판별 유니온 `kind` | route 분기가 타입으로 강제, 잘못된 조합 불가 | 타입 정의 추가 | ✅ |
| `features/result/model`에 훅 | 폴더 추가 없음 | result→auth·analysis·upload feature 교차 import 위반 | ❌ |
| `widgets/result-source/` | FSD 준수, #118과 일관 | — | ✅ |
| `useLocalSearchParams`까지 훅 안으로 | route 더 얇음 | 훅이 라우터에 결합 → 테스트·재사용성↓ | ❌ |

## 3. 영향받는 코드
- 신규: `src/widgets/result-source/**` · 변경: `app/result.tsx` · 새 의존성 없음.

## 5. 위험과 완화
- R1 결과 격리(다른 계정 메모리 결과 노출) 회귀 → 소유자 불일치·userId 없음 케이스 단위 테스트.
- R2 imageByPageId 참조 불안정으로 ResultScreen 불필요 재렌더 → useMemo 유지.

## 6. 롤아웃 / 되돌리기
- 단일 PR. 문제 시 revert(동작 불변).

## 7. 검증
- 단위: 순수 함수 표 기반 + 훅(renderHook, 실제 zustand 스토어·auth 배럴 mock).
- 게이트 `checks.sh`. e2e: result 시나리오(로그인 필요 시 수동).

## 검증 결과 (2026-10-02)
- 단위: `resultSource` 9 · `useResultSource` 5 → 14 PASS(widgets 전체 39). 게이트 `checks.sh` **ALL PASS**.
- 시뮬레이터 실측(로그인 상태): 홈 → "최근 분석 6건" → 첫 문서 탭 → **review 경로** 결과 화면(조항 2건·"원본 미리보기는 이번 세션에서만" 안내) 정상 → "닫기"로 최근 목록 복귀 정상.
- live 경로: 계정 무료 분석 0회라 새 분석 불가 → 시뮬 미실측, 단위(live 판정·이미지 매핑·계정 변경 격리)로 커버.
- 기존 Maestro `result.yaml`·`recent.yaml`·`capture-empty.yaml`은 홈 리디자인(#106·#112) 전 문구("계약서를 담아주세요"·"최근 분석" 섹션)를 기다려 **이번 변경과 무관하게 깨져 있음** → 후속.
