# 0035 — 홈 화면 리디자인 (UI/UX 순서1) — PRD

> **이슈:** #106 · **관련 태스크**: #106 (task, TASK-U1) · **상태**: in-progress · **유형**: UI/UX (화면 리디자인)

## 1. 문제
순서0(토큰·공통 컴포넌트) 완료. 확정 홈 시안(14 페이지: Main 빈상태·Home-Pages·Home-Recent)대로 홈을 리디자인한다. 순서0에서 미룬 **Notice·card shadow**와 홈 전용 요소(BrandHeader·Hero·HowItWorks·무료 분석 칩)를 도입. 현재 홈은 "페이지 유무"만 분기해 **최근 0건과 최근 로딩/실패를 구분하지 못한다**(핵심 결함). 착수 전 Codex 설계 토론 → 수렴안.

## 2. 목표
- G1. **홈 4상태 분기**: 페이지 있음 / 페이지 없음+최근 0건(온보딩 Hero+HowItWorks+Notice) / 페이지 없음+최근 있음(촬영 CTA+최근 섹션+Notice) / 최근 로딩·실패(촬영 가능 유지·로딩/재시도, 온보딩 오인 금지).
- G2. **신규 공용 `Notice`**(tone·아이콘·표시 전용) + **Badge `dot`**. 문구·조건은 홈/feature.
- G3. **홈 전용 요소**: BrandHeader(로고칩+타이틀+48터치 안 38 프로필) · Hero(96 tint 박스+제목 26+부제) · HowItWorks(3단계) · entitlement `FreeQuotaChip`(상태 분기 보존, Badge+dot).
- G4. **card shadow**: tokens `shadow.card` 값 + ui 어댑터(iOS/Android) → **DocumentRow 공통 적용**(홈+/recent, 순서5 영향 포함 검증 — 사용자 결정).
- G5. **최근 섹션**: SectionHeader(label+variant=title+action) 적용, 기존 모두보기 조건·DocumentRow 동작 보존.
- G6. **동작 보존**: 촬영·갤러리·업로드·분석·취소(busy로 막지 않음)·draft 잠금·잔량 갱신·재열람 전부. 상단칩/하단칩 동시표시 금지(상태별 위치 하나).

## 3. 목표가 아닌 것 (Non-goals)
- N1. **썸네일 그리드(2열)** — 보류(사용자 결정). 세로 드래그 리스트 유지, 주변 chrome만 리디자인. 그리드=별도 이슈(드래그 엔진).
- N2. 분석 진행·결과·마이페이지·최근목록 화면 리디자인 = 순서2~5(단, DocumentRow shadow 공통 변경은 /recent에 영향 → 이번에 검증).
- N3. BrandHeader·Hero·HowItWorks의 packages/ui 승격(단일 사용처 → 홈 전용). 재사용 생기면 승격.
- N4. 다크·구독·Chip 공용 컴포넌트.

## 4. 제약 (Constraints)
- 공용 EmptyState 표시 전용 경계 유지(3단계·최근·Notice를 props로 밀어넣지 않음). 공용 기본값(IconBadge·Button) 변경 금지 → 홈 전용 Hero.
- 서버 잔량 기준(클라 차감·0 차단 금지). `useEntitlementSync` 중복 설치 금지. safe area=홈 라우트 단일 소유.
- 세로 드래그 목록을 세로 ScrollView로 감싸지 않음. 완료 전 `checks.sh` PASS(ui 포함).

## Acceptance
- [x] 홈 4상태 분기(페이지/최근0건 온보딩/최근있음/최근 로딩·실패) — 로딩·실패를 0건 온보딩으로 오인하지 않음.
- [x] `Notice`(공용)·Badge `dot` 신설(단위). `FreeQuotaChip`(entitlement, 상태 분기 보존).
- [x] BrandHeader(48터치 안 38 프로필)·Hero·HowItWorks(3단계) 홈 전용 신설, 시안대로.
- [x] card shadow: tokens 값+ui 어댑터, DocumentRow 공통 적용 — 홈·**/recent 양쪽 iOS/Android 실측**(클리핑·가장자리).
- [x] 최근 섹션 SectionHeader(title+action) 적용, 동작·접근성 보존.
- [x] 동작 보존(촬영·분석·취소 non-busy·잠금·잔량·재열람) + 단위 + 시뮬레이터 실측 + 게이트 PASS.
