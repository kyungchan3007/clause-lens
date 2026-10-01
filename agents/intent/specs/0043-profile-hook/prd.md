# 0043 — 프로필 화면 로직 커스텀 훅 분리 — PRD

> **관련 태스크**: #120 · **상태**: in-progress · **유형**: refactor(동작 불변) · **갱신**: 2026-10-02

## 1. 문제
- `features/profile/ui/ProfileScreen.tsx`(ui 세그먼트)에 로직 혼재: 포커스마다 무료 잔량 재조회(`useFocusEffect`), 로그아웃 확인 Alert, 1:1 문의 준비중 Alert, 로그인 수단 라벨 매핑.
- `profile/model` 세그먼트는 FAQ 데이터만 있고 화면 로직은 ui에 있음 → 로직 테스트 불가.

## 2. 목표
- G1. 화면 로직을 `features/profile/model/useProfile()`로 추출 → `ProfileScreen`은 렌더만.
- G2. 로그인 수단 라벨 매핑을 순수 함수 `providerLabelOf()`로 분리 + 단위 테스트.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 화면·문구·흐름 변경 없음.
- N2. `ProfileScreen`을 상위 레이어로 이동(기존 auth·entitlement 교차 import 해소)은 범위 밖 — 후속 판단.
- N3. `MenuRow` packages/ui 승격(백로그 항목)은 범위 밖.

## 4. 제약
- 완료 전 `checks.sh` PASS. 단위 필수, e2e는 기존 profile·logout-cancel 시나리오(동작 불변) 회귀 확인. **logout.yaml은 실행 안 함**(실제 로그아웃 → 카카오 수동 재로그인 필요).

## Acceptance
- [x] `useProfile` 추출, `ProfileScreen`은 렌더 전용(스토어 직접 구독·Alert·useFocusEffect 없음).
- [x] `providerLabelOf` 순수 함수 + 단위 테스트(KAKAO·미등록 코드·없음).
- [x] `useProfile` 훅 단위 테스트(포커스 시 잔량 재조회·로그아웃 확인 후에만 signOut·문의 준비중 안내·사용자 정보).
- [x] 기존 단위 테스트 전부 통과 + 게이트 PASS. (잔재 0042 폴더를 사용자가 정리한 뒤 재실행 ALL PASS)
- [x] e2e: 시나리오 변경 없음, profile·logout-cancel 회귀 확인. (홈 대기 문구만 현재 UI로 바꾼 임시 사본으로 실행 — 원본 yaml 문구 동기화는 별도 작업)
