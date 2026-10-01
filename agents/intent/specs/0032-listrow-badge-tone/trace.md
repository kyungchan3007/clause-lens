# 0032 — 과정 기록 (trace)

## 판단
- **착수 전 Codex 설계 토론**(order0b-proposal → order0b-codex-review). 핵심 반영:
  - **ListRow trailing을 press 영역 제외 → 철회**: DocumentRow 배지·chevron도 행 전체 터치로 문서 열림 보존(원안이 회귀). 독립 버튼은 현재 소비자에 없음 → 0b-1 금지.
  - ListRow 표면 강제 금지 → **variant(card/flat)**. title=string(타이포 소유)·supporting=string|node(자동 Text·자식 색 변경 금지)·selected 제외.
  - **Badge color/bg 같은 변경에서 제거**(소비자 ClauseCard뿐, ui private). tone→역할 정적 매핑. **700≠대비 보증 → 휘도비 ≥4.5:1 단위 검사**. ui는 entities import 금지(tone 문자열만, 소비자가 riskTone→tone 주입).
  - **DocumentRow a11y 버그**: 라벨에 partial·분석 페이지 수 누락("위험 없음"만) → 승격 시 보완.
  - **FreeQuotaRow→Badge 반대**: 로딩/재시도/stale/0회 분기 유지(0b-2에서도). 이번 범위 아님.
  - inline 정리 범위가 더 넓음(RecentAnalysisSection·RecentListScreen·app/index.tsx; aliased `const c=semantic.light`) — 0b-1은 전환 범위만, 나머지는 0b-2.
  - 게이트: UI 테스트는 packages/ui 소유 + **mobile jest-expo 재사용**(복제 금지), checks.sh 별도 항목, ui typecheck 명시.
  - 범위 분할(사용자): 0b-1(리스트/배지) / 0b-2(버튼 등). BrandHeader·Notice·그림자=순서1.
- **사용자 결정(AskUserQuestion)**: ① 0b 둘로 분할 ② BrandHeader·Notice·그림자 순서1로 연기.

## 막힘 / 되돌림
- **UI 테스트 게이트**: rootDir을 packages/ui로 두니 lucide-react-native(ESM) transform이 깨짐 → rootDir=apps/mobile 유지 + roots만 packages/ui/src로(동작하는 mobile 설정 재사용). lucide는 moduleNameMapper로 더미 목(단위는 실제 아이콘 렌더 목적 아님).
- **react-test-renderer 함정**: Pressable은 composite+host가 accessibilityRole을 중복 보유, disabled는 host View prop으로 안 감(composite에만). → prop 단정은 `findAll(role=button).some(...)`로 견고화.
- **ui typecheck**: ui에 typescript 없음 → devDep 추가 + tsconfig에서 테스트 제외(jest 타입 불필요) + `typecheck` 스크립트. nativewind devDep `^`→`~4.2.6`(peer 축소는 0b-2).
- **ListRow trailing press**: 원안의 "trailing press 제외"를 철회 — trailing을 바깥 Pressable 안에 둬 배지·chevron 탭도 행 액션(문서 열림). 시뮬레이터에서 홈 카드 행 확인.
- **제목 타이포 variant**: MenuRow(base) vs DocumentRow(sm/semibold) 차이 → ListRow variant에 title 클래스 포함(card=sm/semibold, flat=base).
- **ProfileScreen 로그아웃**: danger 특수 행이라 ListRow 대신 bespoke Pressable 유지(inline만 color("danger")로 정리).
- **Metro 캐시 staleness**: 브랜치 전환 간 `unknown semantic role: dangerText` 유령 에러 → `expo start --clear` 재번들로 해소(소스엔 dangerText 존재). 실측 교훈(ios-build-gotchas와 동일 계열).
- **되돌림 없음**. FreeQuotaRow는 Badge로 바꾸지 않고 보존(상태 분기). app 피처 잔여 inline(capture·entitlement)·Button/IconButton/SectionHeader/EmptyState는 0b-2.
