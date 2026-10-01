# 0031 — 과정 기록 (trace)

## 판단
- **착수 전 Codex 설계 토론**(사용자 워크플로우): 순서 0 제안서(order0-proposal)를 Codex가 적대 리뷰(order0-codex-review). 핵심 반영:
  - 정정: NativeWind **rem=14**(h-12=42·h-14=49, 48/56 가정 틀림) · preset light 하드코딩·`borderStrong`/`textInverse` 미노출·weight/lineHeight 미배선 · 시안 amber700 vs warning=amber600 · 작은 배지 글자 대비 미달.
  - **"inline만 제거하면 다크 1~2곳"은 거짓** → 테마 경로를 지금 확정(Icon className 미지원·SVG 실제 색 필요). 사용자 결정: **vars()까지 지금 배선**.
  - 위험도 매핑은 **앱 도메인(entities/clause)**에, tone 반환(hex 아님). packages/ui는 백엔드 위험 계약 모름 — tone 받아 그리기만.
  - Chip/Badge 분리 반대 → Badge tone으로(0b). ListRow 최소·슬롯 절제, DocumentRow 전체 승격 반대(도메인 결합) → 0b.
  - 대비: 배지 텍스트 700대 vs 점 600 분리 + severity 접근성 라벨.
  - 범위 모순("정의만" vs "승격") → 사용자 결정: **0a/0b 분할**. 0a=토큰·테마·riskTone / 0b=컴포넌트·승격·게이트(#96 머지 후).
- **사용자 결정(AskUserQuestion)**: ① 테마 경로 = vars()까지 지금 배선 ② 범위 = 둘로 분할.

## 발견한 기존 버그/부채 (후속)
- **`retentionBadge` floor(코드) vs ceil(SDD 0030) 불일치** — 코드(floor="오늘 만료")가 의도. #96 spec 0030 sdd.md 문구를 floor로 정정해야 함(후속, #96은 PR#97로 이미 머지됨 → 별도 수정 커밋 or 0b 때).
- app 피처(capture·profile·entitlement) inline `semantic.light`는 0b에서 정리(컴포넌트 승격과 함께).
- `nativewind >=4.2.0` 범위 → `~4.2.x`로 축소(0b).
- checks.sh에 packages/ui 테스트 미배선(0b).

## 막힘 / 되돌림
- **vars() 배선 리스크 실측 통과**: preset 색을 `var(--cl-*)`로 바꾼 뒤 루트 `ThemeProvider`(vars(cssVars("light")))로 공급 → 시뮬레이터에서 홈 전체 색 정상(촬영하기=Cobalt via var). 폴백(global.css :root) 불필요.
- **Metro 캐시**: preset/토큰 변경은 NativeWind 스타일 재생성 필요 → `expo start --clear` + 앱 재기동(simctl terminate/launch)으로 새 번들 로드해야 검증됨(단순 reload로는 stale).
- **텍스트 vs 하이라이트 색 분리**: riskPresentation.color(텍스트 700)와 accentColor(강조 600) 분리 → ClauseCard 배지는 color, HighlightOverlay는 accentColor 사용(Codex "같은 tone 다른 색").
- **semantic 모듈 export 형태**: `index.js`는 `semantic`을 `{light,dark}`로 노출(기존). color.js는 `semantic.light`에서 해석.
- **되돌림 없음**. app 피처 inline semantic.light(capture·profile·entitlement)와 DocumentRow 위험색은 0b에서 컴포넌트 승격과 함께 정리(이번 scope 제외 명시).
- 후속(trace 상단 "발견한 부채"): retentionBadge floor/ceil 문서 정정 · nativewind 범위 축소 · checks.sh ui 테스트 배선 → 0b.
