# 0035 — 홈 화면 리디자인 (순서1) — SDD

> **관련 PRD**: prd.md · **이슈:** #106

## 1. 접근 (Approach)

### 1-1. 공용(packages/ui)
- **Notice**(신규): `{ tone?('info'|'neutral'), icon?, children }`. 아이콘+텍스트 배너(표시 전용). tone→toneClasses 재사용. 고지/보관 안내 문구는 호출측.
- **Badge `dot?`**(확장): dot=true면 라벨 앞에 StatusDot(tone) 점. icon과 dot 동시 허용(둘 다면 dot 우선 or 둘 다 — dot만 권장). 기존 Badge 사용 불변.
- **card shadow**: tokens `shadow.card`(디자인 값: iOS color/opacity/radius/offset + Android elevation 숫자) + ui 어댑터 `cardShadowStyle`(platform별 RN style 반환). DocumentRow 컨테이너(ListRow card)에 적용 — **공통**(홈+/recent). overflow-hidden 추가 안 함(클리핑 회피).

### 1-2. 홈 전용(apps/mobile/src/features/home/ui, 신규)
- **BrandHeader**: 로고칩(accent 26, Icon)+"ClauseLens"(18 bold)+trailing(프로필). 프로필=48 터치 Pressable 안 38 원형(surface+border) + User 아이콘. safe area 없음.
- **Hero**: 96 tint 박스+아이콘, 제목(26 bold)+부제. 홈 온보딩 전용(공용 EmptyState와 별개 — 크기 차이).
- **HowItWorks**: 3단계 카드(촬영/분석/하이라이트) surface-alt. 좁은 폭 세로 배치 허용.
- (FreeQuotaChip은 entitlement)

### 1-3. 도메인(entitlement)
- **FreeQuotaChip**(신규): entitlement store 구독, 상태 분기(idle 숨김·loading 확인중·error 재시도·ready Badge(info,dot)"무료 분석 N회 남음"·stale 기존값+최신확인실패). 미확인·0 차단 금지. app이 배치(상단/하단 바), capture엔 슬롯으로만.

### 1-4. 홈 조립(app/index.tsx)
- 상태: draft pages 유무 + documents store(status·items)로 **4상태** 계산.
  - pages>0 → CaptureScreen(PageList) + 하단 분석 바(FreeQuotaChip).
  - pages=0 & documents ready & items=0 → Hero + HowItWorks + Notice(고지).
  - pages=0 & items>0 → 촬영 CTA + RecentAnalysisSection(SectionHeader title+action·DocumentRow shadow) + Notice(보관).
  - pages=0 & documents loading/error → 촬영 CTA + 로딩/재시도(온보딩 오인 금지).
- BrandHeader + 상단 FreeQuotaChip(페이지 없음 상태) / 하단 바 FreeQuotaChip(페이지 있음) — 동시표시 금지.
- 세로 드래그 목록을 세로 ScrollView로 감싸지 않음: 온보딩/최근은 스크롤 OK(드래그 없음), 페이지 담음은 DraggableFlatList가 스크롤 소유.
- 기존 merged phase 제어·useEntitlementSync·useDocumentsSync 유지(중복 설치 안 함).

### 1-5. 최근·capture 적용
- RecentAnalysisSection: 자체 제목 → `SectionHeader(label="최근 분석", variant="title", action={label:"모두 보기", onPress})`. 모두보기 조건 보존.
- capture EmptyState: 온보딩 Hero+HowItWorks+Notice는 **app이 조립**(capture EmptyState는 순수 촬영 CTA용으로 축소 or app이 직접 구성). 그리드 보류 → PageList chrome(헤더 "담은 페이지 N장"·하단 바)만 스타일.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 공용 Chip 신설 | 명확 | Badge와 중복(비상호작용 pill) | ❌ → Badge dot |
| BrandHeader/Hero/HowItWorks 공용 승격 | 재사용 | 단일 사용처(0012 위반) | ❌ → 홈 전용 |
| EmptyState에 3단계·Notice props | 조립 간단 | 표시 전용 책임 초과 | ❌ → 홈 조립 형제 |
| shadow를 ListRow card 자동 | 간단 | 모든 card 영향·범위 불명 | ❌ → DocumentRow 공통(명시·검증) |
| shadow 홈 전용 opt-in | /recent 불변 | 사용자 결정=공통 | ❌(사용자: 공통) |
| 그리드 2열 | 시안 일치 | 드래그 엔진 2D 변경·리스크 | ❌ 보류(사용자: 보류) |
| 홈 상태=페이지 유무만 | 현행 | 최근 0건·로딩/실패 구분 불가 | ❌ → 4상태 |

## 3. 영향받는 코드 (Touched Surface)
- `packages/tokens`: shadow.card 값 + export. `packages/ui`: notice.tsx(신규)·badge.tsx(dot)·card-shadow 어댑터·index·tests.
- `apps/mobile/src/features/home/ui/`(신규): BrandHeader·Hero·HowItWorks(+tests). `features/entitlement`: FreeQuotaChip(+test). `features/documents/ui`: DocumentRow(shadow)·RecentAnalysisSection(SectionHeader). `features/capture/ui`: EmptyState·PageList(chrome).
- `apps/mobile/app/index.tsx`: 4상태 조립·BrandHeader·칩 배선.

## 4. 검증 (Verification)
- **단위**: Notice(tone 렌더)·Badge dot·FreeQuotaChip(상태별 출력: idle/loading/error/ready/stale)·BrandHeader/Hero/HowItWorks 렌더·card shadow 어댑터(platform 분기).
- **동작 보존 단위/실측**: 분석 접수·취소(취소 버튼 non-busy)·draft 잠금·최근 재열람·모두보기·문서행 터치.
- **시뮬레이터 실측(필수)**: 홈 4상태 눈으로(온보딩/최근/페이지담음/로딩) · **DocumentRow shadow 홈+/recent iOS·Android 클리핑·가장자리** · 큰 글자 3단계 세로 배치 · 프로필 48 터치.
- **게이트**: `checks.sh` ALL PASS(ui 포함).

## 5. 리스크 / 롤백
- shadow 공통 변경이 /recent(순서5) 외형 변경 → 사용자 승인(공통), 양 화면 실측. 문제 시 DocumentRow shadow prop으로 opt-in 전환.
- 홈 상태 분기 복잡 → 4상태 명시·단위. 로딩/실패 오인 방지 테스트.
- 그리드 보류로 시안과 페이지담음 화면 차이 → PRD N1 명시.
