# SDD — 마이페이지 리디자인 (시안 정렬 + 공용 ScreenHeader)

- **관련 PRD**: 0064-profile-redesign/prd.md
- **이슈:** #171
- **상태**: draft — Claude 설계 토론(2026-10-07) 반영

## 0. 읽은 문서
- 확정 시안(디자인 캔버스 Profile.dc.html), `ProfileScreen.tsx`·`useProfile`·`FaqSection`·`FreeQuotaRow`·`app/profile.tsx`·`app/_layout.tsx`, `packages/ui`(ListRow·IconButton·SectionHeader·IconBadge·ResultHeader 타이포), frontend-architecture(shared-first §75).

## 1. 접근 (Approach)
- 마이페이지 **표현만** 시안 정렬. 데이터·로직(useProfile·auth·entitlement·FAQ)·라우팅 불변.
- 공용 승격은 **ScreenHeader 1개로 제한**(과설계 방지). 행 primitive는 기존 `ListRow` 확장(tone)으로 흡수 — 새 MenuRow component 신설 안 함.

## 2. 고려한 대안 (Alternatives / Trade-offs)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 헤더 | profile 네이티브 Stack 헤더 유지 | ❌ | 앱 내 유일하게 튐 + 시안은 커스텀 흰 헤더(17px/800) 명시 → 네이티브로 스펙 불가 |
| | **공용 `ScreenHeader` 신설(packages/ui)** | ✅ | recent도 동일 구조(back+title) → shared-first, 앱 내 헤더 일관 회복. iOS 스와이프백은 headerShown과 독립(gestureEnabled 기본 true) |
| 헤더 범위 | BrandHeader까지 흡수 | ❌ | BrandHeader는 로고칩+브랜드명+우측 아바타(구조 상이) → 흡수 불가. 실수요 recent+profile 2곳 |
| 행 로그아웃 | 새 `MenuRow` packages/ui 승격 | ❌ | ListRow라는 공용 행 primitive가 이미 있음 → 중복. 소비처가 profile 단일 feature → shared-first 대상 아님(과승격) |
| | **`ListRow`에 `tone?: "default"\|"danger"` 최소 추가** | ✅ | title/leading 색만(color("danger")). 공용 표면 1개(ListRow) 유지, raw Pressable 제거, a11y 자동 |
| 썸네일 | DocumentRow 가로→세로 변경 | ❌ | **이미 48×60(w-12 h-[60px])** — 시안 일치. no-op, regression만. (전제가 stale) |
| 아바타 | 신규 아바타 component | ❌ | 기존 `IconBadge name="User"` 폴리시로 충분(크기·bg 토큰 조정) |
| back 버튼 | ScreenHeader 전용 back primitive | ❌ | 기존 `IconButton icon="ChevronLeft"`(48pt·a11y "뒤로") 재사용 |

## 3. 영향받는 코드 / 순서 (Touched Surface & Plan)
1. **공용 UI**:
   - `packages/ui/src/screen-header.tsx`(신규) + index + 단위: `{ title, subtitle?, onBack?, right? }`. 뒤로=IconButton(ChevronLeft, a11y "뒤로"), 타이틀 `text-[17px] font-extrabold tracking-tight`(ResultHeader 일치), subtitle muted(타이틀 아래 들여쓰기), right 옵셔널 슬롯(이번엔 미사용). 흰 배경 + border-b border-border.
   - `packages/ui/src/list-row.tsx`: `tone?: "default"|"danger"` 추가 — title/leading 색만(default=기존, danger=`color("danger")`/text-danger). 기존 호출 호환(기본 default). + 단위.
2. **마이페이지**:
   - `app/profile.tsx`: `SafeAreaView edges=["top","bottom"]`로 감싸고 `<ScreenHeader title="마이페이지" onBack={router.back}/>` + `<ProfileScreen/>`.
   - `app/_layout.tsx`: profile `Stack.Screen` override(headerShown:true·title·headerBackTitle) **제거**(전역 headerShown:false 상속). `gestureEnabled` 손대지 않음.
   - `ProfileScreen.tsx`: 로그아웃 raw Pressable → `<ListRow variant="flat" tone="danger" leading={<Icon LogOut/>} title="로그아웃" onPress={confirmSignOut}/>`. 프로필 블록 폴리시(아바타 72px·이름 19px·중앙·흰 블록·간격 토큰). 1:1 문의는 기존 로컬 MenuRow/ListRow 유지(최소 변경). FreeQuotaRow 표현 정렬(값 accent+tabular-nums, 로직 불변).
3. **테스트**: `screen-header.test.tsx`(title/subtitle·onBack+label·right), `list-row.test`(tone danger 색·onPress), ProfileScreen render(로그아웃→confirmSignOut·1:1→openInquiry, useProfile 목). 기존 ui/mobile 단위 green 유지.

## 4. 위험과 완화 (Risks)
- R1 커스텀 헤더 전환 시 SafeAreaView 누락 → 상태바 겹침. 완화: profile 루트 SafeAreaView 필수(체크리스트), _layout override 제거.
- R2 iOS 스와이프백 소실. 완화: `gestureEnabled` 손대지 않음(native-stack 기본 true, headerShown과 독립).
- R3 ListRow tone 추가가 기존 소비처 회귀. 완화: tone 기본 default=기존 동작, 색 토큰만.
- R4 FreeQuotaRow(크로스 feature) 표현 수정이 로직 건드림. 완화: 표현-only(className/토큰), store 불변.
- R5 픽셀 정렬은 단위로 못 잡음. 완화: 시뮬 육안 시안 대조.

## 5. 검증 (Verification)
- **단위**: screen-header.test(신규)·list-row tone·ProfileScreen render. 기존 coordinateTransform/drag-sheet/pager 등 불변.
- **게이트**: `bash agents/harness/evals/checks.sh` PASS.
- **maestro**: 홈→프로필(커스텀 헤더 뒤로·스와이프백)·로그아웃 행 노출.
- **시뮬 육안(다음)**: 헤더·아바타 72px·이름 19px·섹션·로그아웃 빨강.
