# 0045 — 분석 결과 화면 리디자인 (TRACE)

- **이슈:** #167

## 2026-10-03

### 착수
- 확정 시안 확인 — 디자인 캔버스 "ClauseLens 화면 시안"(9Gc4yZaTu6WcRxjokrECyb)의 `Result.dc.html`·`Result-Empty.dc.html` 아트보드 정독. 상태=디자인확정·대기(순서3).
- 현재 구현 매핑(Explore): `features/result`(ResultScreen·HighlightOverlay·ClauseCard·ClauseList·coordinateTransform·useResultData), `packages/tokens`(3-tier), `packages/ui` 공용(Badge·SectionHeader·EmptyState·IconButton·Icon·Notice 등), 홈/진행/그리드 리디자인 언어.
- 기능 spec 0022(4b) 확인 — 좌표 변환(svg)·세션 스냅샷·상태 분리·degrade는 불변 가드.
- 이슈 #167 생성 → `gh issue develop`로 `feat/167-result-redesign`(base develop) 생성·체크아웃.

### 설계 토론 (Codex, 완료)
- Codex 리뷰 반영해 설계 확정(sdd §2 대안표):
  - Pager 공용화 찬성 — controlled·1-based `current`·`total===1`만 정적·`0` 숨김·실제 disabled+a11y. "현재 화살표 흰 배경"은 "이동 가능 버튼 흰 배경/비활성"으로 재정의.
  - ResultHeader 전용(FSD — BrandHeader 재사용 금지), 닫기 a11y="분석 결과 닫기".
  - SectionHeader `action` 빈 onPress=가짜 버튼 → 비상호작용 `hint?` 확장. **힌트는 overlay 가능할 때만 노출**.
  - 배지 점 찬성(라벨이 의미 전달). 단 **전역 success를 slate로 바꾸지 말 것**(0건 초록 깨짐) → **riskTone(low): success→neutral**로 도메인 통일 + 토큰 `neutralBg=neutral100·neutralText=neutral600` 역할 추가(전역 surfaceAlt/textMuted 불변).
  - EmptyState `tone` 미지원 → success 최소 확장. **0건은 페이지별**(1/1 고정 금지), done+빈배열에만.
  - 불변=동작(좌표·필터·선택·스냅샷). HighlightOverlay 시각 속성(.14/.28/stroke .6)은 변경 허용. **이미지 카드는 Image·SVG가 같은 내부 viewport 측정**(border/padding 좌표 어긋남 방지).
  - 낮음 근거 원문 생략 = 0022 표시 요구 변경 → 근거 명시.
  - 대비 계산: red700/red50≈5.9·amber700/amber50≈4.8·slate600/slate100≈6.9(≥4.5:1). color() light 고정=다크 미보장.
- 구현 순서: 토큰→(Pager·SectionHeader·EmptyState)→ResultHeader·이미지 카드(좌표 정합 먼저)→카드·배지·힌트·푸터·상태→단위·S20·게이트.

### 구현·검증
- 토큰: `semantic.js`에 `neutralBg`(neutral100)·`neutralText`(neutral600)+다크 추가, `tailwind-preset`(`surface.subtle`/`foreground.subtle`)·`index.d.ts`(SemanticColors) 노출. 전역 surfaceAlt/textMuted 불변.
- 도메인: `entities/clause/risk.ts` `riskTone(low): success→neutral`(초록=안심/0건 보존). `risk.test` 갱신. 소비처 확인(DocumentRow 저위험=회색 점, ProcessingScreen success는 완료 의미라 무관).
- 공용 UI: `tone.ts` neutral→neutralBg/neutralText(+test), `pager.tsx` 신규(+test 6건·index export), `section-header.tsx` count/hint 확장(trailing null 제거로 기존 test 호환), `icon-badge.tsx`·`empty-state.tsx` tone 확장.
- 결과: `ResultHeader.tsx` 신규(닫기 a11y "분석 결과 닫기"+Pager), `ResultScreen.tsx` 리디자인(헤더·이미지 바깥카드/안쪽 측정뷰 분리·섹션헤더 count/hint(overlay 시만)·0건 success EmptyState·항상 푸터 고지), `ClauseCard` 배지 점, `HighlightOverlay` 시각 속성(.14/.28·strokeOpacity .6·rx3) — 좌표 계산 불변.
- 게이트: checks.sh **ALL PASS**(타입에러 1건=SemanticColors 누락·UI 테스트 2건=인스턴스 중복/ children 배열 → 수정 후 통과). maestro S20 섹션헤더·푸터 assert 추가.
- 남음: 시뮬 육안 검증(다음).
