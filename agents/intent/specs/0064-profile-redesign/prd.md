# PRD — 마이페이지 리디자인 (시안 정렬 + 공용 ScreenHeader)

- **이슈:** #171
- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-07
- **관련 태스크**: TASK-U4(마이페이지 — TASK-U4~5 분리 ①)

## 1. 문제 (Problem)
- 마이페이지만 네이티브 Stack 헤더(headerShown:true)라 앱 내 다른 화면(전부 커스텀 헤더)과 혼자 튄다.
- 로그아웃이 raw Pressable, 프로필 블록·간격이 확정 시안과 미세 불일치.

## 2. 목표 (Goals)
- G1. 확정 시안대로 커스텀 헤더 + 프로필 블록 + 섹션(내 이용·FAQ·문의·계정) 정렬.
- G2. 로그아웃을 공용 행 primitive로 통일(raw Pressable 제거), a11y 유지.
- G3. 동작 불변(useProfile·auth signOut·entitlement·FAQ·라우팅).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 최근목록 리디자인(별도 이슈 #172 예정).
- N2. BrandHeader·ResultHeader 리팩터(이번 범위 아님).
- N3. 다크모드(color() light 고정). EmptyState 교체(마이페이지엔 empty 없음).
- N4. FAQ/1:1문의 실제 콘텐츠·기능(현재 stub 유지).

## 4. 사용자 흐름 (User Flow)
1. 홈 BrandHeader 프로필 → /profile 진입.
2. 커스텀 헤더(뒤로+"마이페이지") → 뒤로/iOS 스와이프백으로 홈 복귀.
3. 프로필 블록(아바타·이름·provider) → 내 이용(남은 무료 분석) → FAQ 아코디언 → 1:1 문의 → 로그아웃(확인 Alert).

## 5. 성공 지표 (Success Metrics)
- 시뮬레이터 육안이 시안과 일치(헤더·아바타 72px·이름 19px·섹션).
- 로그아웃 render 테스트가 confirmSignOut 호출. 기존 단위 green 유지. checks.sh PASS.

## 6. 제약 (Constraints)
- Expo v57, 새 의존성 없음(react-native-safe-area-context 기존). 서버 진실·표현만.
- 색/간격 하드코딩 금지(tokens). 터치 44pt·a11y. `gestureEnabled` 변경 금지(스와이프백 보존).

## Acceptance
- [x] 마이페이지가 커스텀 `ScreenHeader`(뒤로+타이틀) 사용, `_layout` 네이티브 헤더 override 제거, iOS 스와이프백 유지(gestureEnabled 손대지 않음).
- [x] `app/profile.tsx`를 `SafeAreaView edges=["top","bottom"]`로 감싸 상태바/노치 겹침 없음.
- [x] 로그아웃이 `ListRow tone="danger"`(빨강 title, color 토큰 leading) — raw Pressable 제거, a11y role/label 유지, confirmSignOut 동작 불변(render 테스트).
- [x] 프로필 블록(아바타·이름 extrabold·중앙·흰 블록 bg-surface) 시안 정렬. (72px/19px 픽셀은 시뮬 육안 확인)
- [x] 공용 `ScreenHeader` packages/ui 신설 + 단위(4건), `ListRow tone` 단위(2건).
- [x] 동작 불변: useProfile·auth signOut·entitlement(FreeQuotaRow 표현만)·FAQ·라우팅.
- [x] 단위 + ProfileScreen render(로그아웃→confirmSignOut·1:1→openInquiry) + `bash agents/harness/evals/checks.sh` PASS(ui 68·mobile 284).
- [ ] 시뮬레이터 육안(헤더·아바타 72px·이름 19px·로그아웃 빨강·스와이프백) — 다음 단계(백엔드+로그인 필요).

## 7. 미해결 질문 (Open Questions)
- Q1. 1:1 문의 행을 로컬 MenuRow 유지 vs ListRow 직접 — SDD에서 확정(로컬 제거 최소화).
