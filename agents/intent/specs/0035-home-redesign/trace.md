# 0035 — 과정 기록 (trace)

## 판단
- **착수 전 Codex 설계 토론**(order1). 핵심 반영:
  - Chip 신설 반대 → Badge dot + entitlement FreeQuotaChip(도메인·상태 분기).
  - BrandHeader·Hero·HowItWorks 홈 전용(단일 사용처)·Notice만 공용. 38 시각 ≠ 48 터치(IconButton size로 불가).
  - PageList는 세로 DraggableFlatList(그리드 아님). 그리드=드래그 엔진 변경 → 보류. DocumentRow overflow-hidden 없음(클리핑 버그 아님).
  - card shadow: tokens 값 + ui 어댑터, ListRow 자동 금지. DocumentRow 공통 변경은 /recent 영향 → 명시·검증.
  - 잔량 칩: FreeQuotaChip(상태 포함) + app 배치·capture 비결합, useEntitlementSync 중복 금지, 상단/하단 칩 동시표시 금지.
  - EmptyState 표시 전용 경계 유지·히어로는 홈 전용(크기 차이). **홈 4상태 계약**(페이지/최근0건/최근있음/로딩·실패) — 로딩·실패를 0건 온보딩으로 오인 금지.
  - 동작 보존: busy를 취소 버튼에 적용 금지·드래그/잠금 UI disabled 일치·세로 드래그를 세로 ScrollView로 안 감쌈·SectionHeader는 label+variant=title+action.
- **사용자 결정(AskUserQuestion)**: ① 썸네일 그리드 **보류**(세로 리스트 유지, chrome만) ② card shadow **공통 적용**(홈+/recent, 이번에 함께 검증).

## 막힘 / 되돌림
- (구현 중 기록)
