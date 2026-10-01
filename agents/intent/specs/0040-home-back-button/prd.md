# 0040 — 홈으로 돌아가기 버튼 (캡처 플로우) — PRD

> **이슈:** #116 · **상태**: in-progress · **유형**: UI/네비게이션 · **갱신**: 2026-10-01

## 1. 문제
홈 route 내부 상태(담은 페이지·진행 화면·무료 소진 등)에서 **빈 홈으로 나갈 버튼이 없다**. 페이지를 담으면 전부 삭제하지 않는 한 홈으로 못 돌아감. (routes: profile 네이티브 back·recent ChevronLeft·result 닫기는 이미 존재.)

## 2. 목표
- G1. **BrandHeader "홈으로" 버튼**: 홈 플로우 안쪽(hasPages = 담은 페이지·진행·터미널·무료소진)에서 좌측에 ChevronLeft "홈으로" 표시. 누르면 담은 페이지·업로드·분석 세션 초기화(기존 onReset) → 빈 홈.
- G2. **빈 홈(루트)에선 미표시** — 로고칩만(시안 유지). 프로필 버튼 유지.

## 3. 목표가 아닌 것 (Non-goals)
- N1. routes(profile·recent·result) back 스타일 통일 — 각자 back 있음(후속 판단).
- N2. "홈으로" 확인 다이얼로그(즉시 초기화). 담은 페이지 보존 모드.

## 4. 제약 (Constraints)
- BrandHeader 단일 사용처(홈). onReset은 기존 로직 재사용(cancelAnalysis+resetUpload+ref 해제+clearDraft). 완료 전 `checks.sh` PASS.

## Acceptance
- [ ] 담은 페이지·진행·무료소진 상태 BrandHeader 좌측 "홈으로"(ChevronLeft)·누르면 빈 홈 복귀.
- [ ] 빈 홈에선 홈 버튼 없음(로고). 프로필 유지.
- [ ] 단위(BrandHeader onHome 유무) + 시뮬레이터 + 게이트 PASS.
