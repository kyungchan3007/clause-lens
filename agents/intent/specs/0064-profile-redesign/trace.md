# 0064 — 마이페이지 리디자인 (TRACE)

- **이슈:** #171

## 2026-10-07

### 착수
- TASK-U4~5를 2이슈로 분리(사용자 지정) — 마이페이지 먼저(#171), 최근목록 후속(#172 예정).
- 확정 시안(Profile.dc.html) 정독. 현재 구현 매핑(Explore): profile 네이티브 헤더·로그아웃 raw Pressable·프로필 블록 미세 불일치.

### 설계 토론 (Claude 서브에이전트, 완료)
- Codex 대신 Claude 서브에이전트로 적대적 설계 리뷰(사용자 지정: "다른 세션 불러 토론").
- 전제 교정: ① DocumentRow 썸네일 이미 48×60(시안 일치, no-op) ② DocumentRow는 홈과 공용 아님(홈은 RecentEntryButton) ③ profile만 네이티브 헤더라 혼자 튐(커스텀 전환=앱 내 일관 회복).
- 결론: **공용 신설 ScreenHeader 1개로 제한**. MenuRow 승격 폐기 → ListRow에 tone 추가로 흡수. 썸네일 손대지 않음. profile 커스텀 전환 시 **SafeAreaView 필수**·_layout override 제거·gestureEnabled 보존. 부제 헤더 이동. EmptyState 교체는 선택(마이페이지엔 empty 없어 무관).

### 구현·검증
- 공용: `packages/ui/src/screen-header.tsx`(신규, {title,subtitle?,onBack?,right?}, 타이포 ResultHeader 일치·뒤로=IconButton) + index export + 단위. `list-row.tsx`에 `tone?: "default"|"danger"`(제목 색만, text-danger) + index export + 단위.
- 마이페이지: `app/_layout.tsx` profile override 제거(전역 headerShown:false 상속). `app/profile.tsx` SafeAreaView edges top/bottom + ScreenHeader(뒤로=router.back) + ProfileScreen. `ProfileScreen.tsx` 로그아웃 raw Pressable→`ListRow tone="danger"`(leading LogOut danger), 프로필 블록 폴리시(IconBadge 36·이름 extrabold·흰 블록 bg-surface). `FreeQuotaRow`(entitlement) 값 accent+800+tabular-nums(표현만).
- 테스트: `screen-header.test`(신규 4건)·`list-row.test` tone 2건·`ProfileScreen.test`(신규: displayName·로그아웃→confirmSignOut·1:1→openInquiry). maestro `profile-back.yaml`을 커스텀 "뒤로" 버튼으로 갱신(스와이프백은 gestureEnabled 보존·시뮬 육안).
- 게이트: `bash agents/harness/evals/checks.sh` **ALL PASS**(ui 68·mobile 284). 부수: expo-doctor가 expo-constants 패치 기대 드리프트(57.0.20 vs 57.0.21)로 실패 → `expo.install.exclude`에 추가(기존 minimumReleaseAge 홀드 패턴, 버전 bump은 중복 유발이라 배제).
- 남음: 시뮬레이터 육안(헤더·아바타 72px·이름 19px·로그아웃 빨강·스와이프백) — 백엔드+로그인 필요, 다음 단계.

### 시뮬 육안 (2026-10-07)
- 로컬 백엔드 기동 + 카카오 로그인(사용자 직접). 홈 우상단 프로필 → /profile 진입.
- ScreenHeader(뒤로+"마이페이지"), 중앙 프로필 블록(IconBadge 아바타+"박경찬" extrabold+"카카오 계정으로 로그인"), "내 이용" 섹션 "남은 무료 분석 0회"(primary 색·tabular-nums 우측 정렬), "자주 묻는 질문" FAQ 아코디언 5건, "문의" 1:1 문의 row, "계정" 섹션 로그아웃(red 텍스트+LogOut 아이콘, flat). 뒤로 버튼 → 홈 복귀 정상.
- 시안(Profile.dc.html)과 일치. 무료 분석 0회여도 화면 표현 정상(쿼터 소모 없음).
