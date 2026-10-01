# 0042 — 결과 route 판정 로직 커스텀 훅 분리 — PRD

> **관련 태스크**: #119 · **상태**: in-progress · **유형**: refactor(동작 불변) · **갱신**: 2026-10-02

## 1. 문제
- `apps/mobile/app/result.tsx`에 결과 경로 판정 로직과 마크업이 혼재.
- 스토어 구독 6개(auth·analysis·upload), "방금 분석한 문서" 판정(`isLive` — 문서 id·소유자 일치·결과 존재), 이미지 매핑(`imageByPageId` useMemo)이 route 안에 있음.
- 결과 격리(소유자 일치) 판정이 테스트 불가 상태.

## 2. 목표
- G1. 판정을 커스텀 훅 `useResultSource(documentId)`로 추출 → `{ kind: "live" | "review" | "none" }` 판별 유니온 반환.
- G2. 판정·이미지 매핑을 순수 함수(`isLiveResult`·`toImageByPageId`)로 분리 + 단위 테스트.
- G3. route는 `kind`로 분기 렌더 + 네비게이션만.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 화면·문구·흐름 변경 없음.
- N2. `ReviewResult`(재열람 4상태 마크업)는 이미 `useDocumentReview` 훅을 쓰는 렌더 전용 컴포넌트라 유지. 위치 이동(파일 분리)은 후속 판단.
- N3. URL 파라미터 파싱(`useLocalSearchParams`)·`router.back()`은 route(screens 레이어)에 유지.

## 4. 제약
- FSD: auth·analysis·upload 교차 조합 → feature에 둘 수 없음 → `src/widgets/result-source/`(#118에서 도입한 widgets 레이어).
- 완료 전 `checks.sh` PASS. 단위 필수, e2e는 기존 result 시나리오(동작 불변) 회귀 확인.

## Acceptance
- [x] `useResultSource` 추출, `app/result.tsx`는 렌더·네비게이션 전용(스토어 직접 구독·useMemo 없음).
- [x] `isLiveResult`·`toImageByPageId` 순수 함수 + 단위 테스트(소유자 불일치·문서 id 불일치·결과 0건·이미지 없는 페이지).
- [x] `useResultSource` 훅 단위 테스트(live·review·none 분기).
- [x] 기존 단위 테스트 전부 통과 + 게이트 PASS.
- [x] e2e: 시나리오 변경 없음, 결과 화면 회귀 확인. (review 경로 시뮬 실측 PASS. live 경로는 무료 0회라 새 분석 불가 → 단위 테스트로 커버. 기존 result.yaml은 리디자인 전 문구라 깨져 있음 — 후속)
