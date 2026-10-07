<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #171

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/171
- 캡처: 2026-10-07

---
## 배경
- 마이페이지만 네이티브 Stack 헤더(headerShown:true)라 앱 내 다른 화면(커스텀 헤더)과 혼자 튐
- 로그아웃이 raw Pressable, 프로필 블록·간격이 확정 시안과 미세 불일치

## 요구 (확정 시안)
- 커스텀 흰 헤더: 뒤로 + "마이페이지"(17px/800)
- 프로필 블록(중앙·흰 배경): 72px 원형 아바타 + 이름(19px/800) + "{provider} 계정으로 로그인"
- 내 이용: "남은 무료 분석 · N회"
- 자주 묻는 질문: FAQ 아코디언(유지)
- 문의 · 계정: "1:1 문의" + "로그아웃"(빨강)

## 설계 (Claude 설계 토론 반영 — 상세 spec SDD)
- 공용 `ScreenHeader`(packages/ui) 신설: `{title, subtitle?, onBack?, right?}` — 타이포 ResultHeader 일치(17px/800), 뒤로=기존 IconButton(ChevronLeft). (최근목록 이슈가 소비)
- `ListRow`에 `tone?: "default"|"danger"` 최소 추가(title/leading 색만, color("danger")) → 로그아웃 raw Pressable 대체. **MenuRow 공용 승격은 폐기(과설계)**
- `app/profile.tsx`: `SafeAreaView edges=["top","bottom"]` 추가(현재 없음) + ScreenHeader, `_layout` profile override(headerShown/title/headerBackTitle) 제거, `gestureEnabled` 손대지 않음(스와이프백 보존)
- 프로필 블록·간격은 폴리시(토큰, className 조정)

## Acceptance
- [ ] 마이페이지가 커스텀 ScreenHeader(뒤로+타이틀) 사용, 네이티브 헤더 override 제거, iOS 스와이프백 유지
- [ ] `app/profile.tsx` SafeAreaView로 상태바/노치 겹침 없음
- [ ] 로그아웃이 `ListRow tone="danger"`(빨강 title/아이콘, color 토큰) — raw Pressable 제거, a11y role/label 유지, confirmSignOut 동작 불변
- [ ] 프로필 블록(아바타 72px·이름 19px·중앙·흰 블록) 시안 정렬
- [ ] 공용 `ScreenHeader` packages/ui 신설 + 단위, `ListRow tone` 단위
- [ ] 동작 불변: useProfile·auth signOut·entitlement(FreeQuotaRow)·FAQ·라우팅
- [ ] 단위 + ProfileScreen render(로그아웃→confirmSignOut·1:1→openInquiry) + `bash agents/harness/evals/checks.sh` PASS + 시뮬 육안

## 범위 밖
- 최근목록 리디자인(별도 이슈), BrandHeader/ResultHeader 리팩터, 다크모드, EmptyState 교체
