# 0038 — 홈 리디자인 보정 — SDD

> **관련 PRD**: prd.md · **이슈:** #112 · **갱신**: 2026-10-01

## 1. 접근 (Approach)

### 1-1. Hero (home/ui)
- `Hero.tsx`: 아이콘 `ScanLine` → **`ShieldCheck`**(이미 레지스트리에 있음), 색 네이비(`color("foreground")` — 시안의 짙은 방패). 박스·제목·부제 유지.

### 1-2. DocumentRow (documents/ui) — 공용
- `completedAtLabel`(lib/retentionBadge): today → **"오늘"**(시간·pad 제거), 어제 → "어제", 그 외 → "M/D".
- `DocumentRow` leading: `FileText` 아이콘 박스 → **라인 플레이스홀더**(60×48 박스 안 연한 가로 라인 3개, bg-border). 썸네일 느낌·표시 전용.

### 1-3. 홈 '최근있음' 진입 버튼 (documents/ui 신규)
- **`RecentEntryButton`**: documentsStore 구독. status loading→스피너 카드 / error→"다시 시도" / count 0→null(온보딩이 처리) / count>0→**"최근 분석 N건" + chevron** 카드, onPress=onSeeAll(→/recent). FileClock 아이콘.
- `RecentAnalysisSection`(인라인 미리보기)은 홈에서 더 이상 사용 안 함 → 제거(소비처 app/index만). /recent 전체 화면은 기존 RecentListScreen 유지.

### 1-4. 홈 조립 (app/index)
- 비온보딩(최근있음·로딩·실패) 분기: `RecentAnalysisSection` → **`RecentEntryButton onSeeAll={→/recent}`**. 온보딩(Hero+HowItWorks)·Notice·4상태 계산·촬영/갤러리 CTA 유지.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 최근 인라인 미리보기 유지(시안 Home-Recent) | 시안 일치 | 사용자가 "원할 때 인터랙션"을 원함 | ❌ |
| 접기/펼치기 토글 | 홈 내 유지 | 상태·구현 추가 | ❌(사용자: 진입 버튼) |
| 바텀시트 | 몰입 | 구현 복잡 | ❌ |
| **진입 버튼 → /recent 전체화면** | 홈 간결·기존 화면 재사용 | 최근을 홈에서 바로 못 봄 | ✅ 사용자 결정 |
| DocumentRow 실제 썸네일 | 충실 | 서버 썸네일 필요 | ❌ → 라인 플레이스홀더(후속 썸네일) |
| Hero 색 primary 유지 | 변경 적음 | 시안은 네이비 방패 | ❌ → foreground(네이비) |

## 3. 검증 (Verification)
- **단위**: `completedAtLabel` today→"오늘"·어제·M/D(시간 없음) · RecentEntryButton(loading/error/0건 null/N건 라벨·onSeeAll) · Hero(ShieldCheck 렌더) · DocumentRow(라인 플레이스홀더·상대일, a11y 라벨 보존).
- **게이트**: `checks.sh` PASS(typecheck·ui·mobile).
- **시뮬레이터**: 온보딩 Hero 방패 · 최근있음 진입 버튼→/recent · /recent 카드 날짜 "오늘/어제"·라인 썸네일.
- 로그인 상태 활용(이번 세션). 실제 이미지 썸네일은 후속.
