# 0012 — 공유 UI 승격 (IconBadge·SectionHeader) + 색상 토큰화

> **관련 태스크**: #43 · **상태**: draft · 성격: refactor(외부 동작 불변)
> **depends**: #38(프로필 UI) · 스택 PR(base task/038)

## PRD (왜/무엇)

### 1. 문제
피처에 흩어진 재사용 UI 패턴 중복 + capture의 하드코딩 색상(raw hex)이 profile의 토큰 사용과 불일치.

### 2. 목표 (검토 결과)
- **A. `IconBadge`** 승격 — 원형 tint 배경 + 아이콘. 중복: capture/EmptyState(FileText) + profile/ProfileScreen(User).
- **B. `SectionHeader`** 승격 — muted xs 섹션 라벨. profile 3회(FaqSection·문의·계정).
- **D. 색상 토큰화** — capture(PageItem·PageList·EmptyState) raw hex → `@clause-lens/tokens` `semantic`.

### 3. 비목표 (백로그)
- **C. `MenuRow`/`ListRow`** — 단일 사용(profile) → 2번째 사용처(설정/구독) 생길 때 승격(과설계 방지). TASKS 백로그 등재.

### Acceptance
- [x] `packages/ui`에 `IconBadge`·`SectionHeader` + export
- [x] EmptyState·ProfileScreen·FaqSection이 shared 컴포넌트 사용
- [x] capture 아이콘 색 hex → semantic 토큰
- [x] **외부 동작·화면 동일**(시뮬레이터 스모크: Capture·프로필 렌더 동일)
- [x] `checks.sh` PASS

---

## SDD (어떻게)

### 1. 승격 기준 (frontend-architecture)
"과설계 금지 — 재사용될 때 승격"(rule of three). A(2피처)·B(3회) 충족 → 승격. C(1회) → 보류.

### 2. 컴포넌트
- `packages/ui/src/icon-badge.tsx`: `<IconBadge name size? color? className? />` — 컨테이너 기본 `h-20 w-20 rounded-full bg-primary-tint`, 아이콘 기본색 `semantic.light.primary`.
- `packages/ui/src/section-header.tsx`: `<SectionHeader label className? />` — 기본 `px-4 pb-2 pt-6 text-xs font-medium text-foreground-muted`.

### 3. 색상 매핑 (정확 매치 = 화면 동일)
| hex | 토큰 | 비고 |
| --- | --- | --- |
| `#2563EB` | `semantic.light.primary`(cobalt600) | 정확 |
| `#64748B` | `semantic.light.textMuted`(neutral500) | 정확 |
| `#B6BCC7`(inactive grip) | `semantic.light.borderStrong`(neutral300) | 오프팔레트 → 팔레트로 정규화(미세) |

### 4. 검증
- typecheck + `checks.sh`(mobile은 packages/ui까지 컴파일).
- 시뮬레이터: Capture(IconBadge)·프로필(IconBadge·SectionHeader) 렌더 동일 확인.

### 5. 후속
- C(MenuRow/ListRow) 승격, 다크모드 토큰(semantic.dark) 적용 시 Icon 색도 스킴 반응.
