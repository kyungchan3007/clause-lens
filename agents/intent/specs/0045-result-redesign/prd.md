# 0045 — 분석 결과 화면 리디자인 (PRD)

- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-03
- **이슈:** #167

## 1. 문제 (Problem)
- 결과·하이라이트 화면이 홈/진행/그리드 리디자인(순서0~2)의 디자인 언어와 어긋남 — 투박한 이전/다음 Button pager, 평범한 헤더, 섹션 헤더 부재.
- 기능은 0022(4b)에서 확정·구현됨 — **비주얼만 뒤처져** 사용성·포트폴리오 모두 개선 필요.

## 2. 목표 (Goals)
- 확정 시안(디자인 캔버스 "ClauseLens 화면 시안")대로 **결과 화면 비주얼 리디자인**. 로직 불변.

## 3. 목표가 아닌 것 (Non-goals)
- 좌표 변환·overlay·상태 분리·세션 스냅샷 로직 변경(0022 불변)
- box→list 역방향 선택(후속)
- review(재열람) 서버 이미지 다운로드(TASK-006 후속)

## 4. 범위 (Scope, 비주얼만)
- 헤더: 닫기 칩 + "분석 결과" + **페이지 네비 알약**(‹ 1/3 ›)
- 섹션 헤더 신설: "확인이 필요한 조항 N"(숫자=Cobalt) + "탭하면 사진에서 강조"
- 이미지 영역 카드 스타일(radius·border·연한 bg)
- 조항 카드: 현행 유지 + 위험 배지 점(dot) 정렬
- 0건: 초록 체크 EmptyState + 안심 문구
- 푸터 참고 고지 유지

## 5. 성공 지표 (Success Metrics)
- 시안 일치 · `bash agents/harness/evals/checks.sh` ALL PASS · 단위 + maestro(S20) 갱신

## 6. 제약 (Constraints)
- 색은 전부 토큰(className/`color()`), 하드코딩 금지 · 색 단독 금지(색+라벨/점)
- shared-first: 범용 조각은 `packages/ui` 승격

## 7. 미해결 질문 (Open Questions)
- Q1. 페이지 네비 알약 공용 승격 범위 · 배지 점 vs 아이콘 · 헤더 패턴 → **Codex 설계 토론서 확정(진행 중)**

### Acceptance
- [x] 헤더(닫기·타이틀·페이지 네비 알약) 시안대로 — `ResultHeader` + 공용 `Pager`
- [x] 섹션 헤더("확인이 필요한 조항 N" + 힌트) — `SectionHeader` count/hint, 힌트는 overlay 가능 시만
- [x] 이미지 영역 카드 스타일 + overlay 정상(있을 때) — 바깥 카드/안쪽 측정 뷰 분리(좌표 정합)
- [x] 조항 카드 배지 점 정렬·위험톤 유지 — `Badge dot`, 낮음=neutral
- [x] 0건 초록 체크 EmptyState — `EmptyState tone="success"`, 페이지별 조건
- [x] 페이지 네비 알약 `packages/ui` 승격 + 단위 테스트 — `pager.tsx` + `pager.test.tsx`
- [x] 로직/좌표 변환 불변(회귀 없음) — 좌표/상태/스냅샷 로직 미변경, coordinateTransform 단위 유지
- [x] `checks.sh` PASS + 단위 + maestro(S20) 갱신 — ALL PASS, S20 섹션헤더·푸터 assert 추가
- [ ] 시뮬레이터 육안 검증(300dp·배지·푸터·0건·다중박스) — 다음 단계(실행 대기)
