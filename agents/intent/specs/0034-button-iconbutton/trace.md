# 0034 — 과정 기록 (trace)

## 판단
- **착수 전 Codex 설계 토론**(order0b2). 핵심 반영:
  - Button **className뿐 아니라 style·무제한 spread 차단**(허용 native props만). fullWidth 기본 배치 보존(ResultScreen 행·capture stretch). 상태색 내부 1회 매핑→Text class/Icon·spinner color(). **스피너=선행 슬롯 대체+label 유지**. accessibilityState disabled=disabled||busy + busy.
  - **busy를 화면 active에 일괄 연결 금지** — PageList "취소"는 분석 중에도 눌려야(회귀).
  - IconButton **minW/H 48**(padding 추정 금지)·아이콘 레지스트리(빈 활성 버튼 금지). 교체=app/index 마이페이지·RecentListScreen 뒤로. **PageItem 드래그 핸들 제외**(onLongPress 필요).
  - SectionHeader 현재 `px-4 pt-6` 여백 소유 → title variant 여백 소유권 명시(이중 여백 방지).
  - EmptyState hero Fragment→View 시 너비 축소 주의(w-full 계약). 홈은 0건이어도 extra 경로 유지.
  - FreeQuotaRow = Ticket 아이콘 색만, 상태 분기 보존(0회·idle·stale).
  - 정정: ResultScreen 이미 disabled 사용 · 마이페이지 아이콘=app/index · 잔여에 FaqSection 포함 · **#103 아닌 #101 develop 기반 브랜치**.
  - 범위명 "inline 정리"→"semantic.light 직접 참조 정리"(진행률 width·이미지 크기 제외).
- **사용자 결정**: 0b-2 착수(Codex 토론부터). Button md 최소 높이=48(Android 일관, Claude 결정·Codex 권장).

## 막힘 / 되돌림
- Button render-prop children으로 pressed 오버레이(absolute View) — 비활성 시 미표시. className/style 표면 제거(허용 native props만).
- react-test-renderer: accessibilityRole/state는 composite+host 중복 → `.some`으로 단정.
- 이관 시 import 잔재(RecentListScreen Pressable 다시시도·app/index) 타입에러 → 사용 남은 것만 유지.
- 잔여 semantic.light 정리: PageList·PageItem·FaqSection·FreeQuotaRow(아이콘)·app/index → color(). PageItem Trash2는 레지스트리 밖이나 Icon 문자열 fallback으로 렌더(IconButton/Button만 IconName 강제).
- 커밋 3단계(1 Button·IconButton+이관 / 2 SectionHeader·EmptyState+capture / 3 색 정리+peer). nativewind peer ^4.2.6(lockfile 4.2.6 불변).
- **시뮬레이터 로그인 이후 실측(EmptyState·IconButton)은 세션 만료로 미수행 — 번들 클린 로드+단위+게이트로 커버, 로그인 후 육안은 후속.** 되돌림 없음.
