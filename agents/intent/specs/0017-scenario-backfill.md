# 0017 — 기존 기능 e2e 시나리오 백필 (S9~S15)

> **관련 태스크**: #57 · **상태**: in-progress · **유형**: test/e2e
> **depends**: 트리거 규칙 [loop.md §시나리오 트리거](../../harness/loop.md) · e2e 시스템 [.maestro/SCENARIOS.md](../../../apps/mobile/.maestro/SCENARIOS.md)

## PRD (왜/무엇)

### 1. 문제
현재 구현된 화면(촬영·FAQ·로그아웃·프로필) 중 **기존 시나리오(S1~S8)로 안 덮인 흐름**이 있다. 트리거 규칙상 "기존 시나리오로 안 덮이면 추가"에 해당 → 커버 확대.

### 2. 목표
- 실제 구현된 UI 문자열 기준으로 S9~S15 시나리오 추가(문서 + 가능하면 yaml).
- 자동 가능한 것은 yaml, OS 피커/드래그 등 브리틀은 반자동/문서로 정직하게 구분.

### 3. 비목표
- 앱 코드 변경 없음(순수 시나리오/문서). 미구현 흐름(분석하기=TASK-003)은 제외.

### Acceptance
- [x] SCENARIOS.md에 S9~S15 추가
- [x] yaml: S9~S12(자동) + S13~S14(반자동)
- [x] S15 문서화(수동 관측)
- [x] assert 문자열 실제 UI와 일치
- [x] checks.sh PASS
- [x] (가능 시) maestro 실행 관측 — **완료**: 로그인(카카오 수동) 후 S9~S12 maestro 4/4 PASS, S13~S14 피커 수동으로 실측 PASS, S15 문서만

## SDD (어떻게)

### ① 읽은 코드(문자열 근거)
- `CaptureScreen`/`EmptyState`/`PageList`/`PageItem`: "계약서를 담아주세요", "촬영하거나 갤러리에서 불러올 수 있어요", "촬영하기", "갤러리에서 선택", "{n}페이지", "분석하기", "페이지 추가", "끌어서 순서 변경 · 탭해서 교체", a11y "페이지 삭제"·"페이지 교체"·"순서 변경".
- `FaqSection`/`faq.ts`: "자주 묻는 질문" + 5문항. 단일 열림(openIndex 하나) — 한 항목 열면 이전 항목 닫힘.
- `ProfileScreen`: a11y "마이페이지"(헤더), Alert "로그아웃 하시겠어요?"("취소"/"로그아웃").
- 인증 게이트: 로그인 후 화면만 접근 → post-login 흐름은 `clearState:false`(login.yaml 선행) 전제.

### ② 시나리오별 접근
- **S9 촬영 빈 상태**(auto): 재실행 시 draft store 리셋 → 빈 상태 assert.
- **S10 FAQ 단일 열림**(auto): 항목1 열기→답1, 항목2 열기→답2 + 답1 닫힘(단일 열림 검증). Maestro 전체텍스트 매칭 → 답변은 `.*부분.*`.
- **S11 로그아웃 취소**(auto): 확인 다이얼로그 "취소" → 프로필 유지.
- **S12 프로필 뒤로가기**(best-effort): iOS 네이티브 back은 `back`/스와이프가 브리틀 → 좌측 엣지 스와이프, 실패 허용 표기.
- **S13 페이지 추가**(반자동): "갤러리에서 선택"→OS 피커 **수동 선택**→"1페이지"/"분석하기"/"페이지 추가".
- **S14 페이지 삭제**(반자동): 추가(수동) 후 a11y "페이지 삭제"→빈 상태 복귀.
- **S15 순서변경**: 드래그+2장 수동 피커라 Maestro 브리틀 → **문서만**(수동 관측).

### ③ 고려한 대안·트레이드오프
- **전부 yaml 강행** — S13~S15는 OS 피커/드래그 의존이라 CI 브리틀 → 헛통과·플레이크. ✗
- **자동/반자동/문서 3단 구분(채택)** — 정직하게 커버 범위 표시. login/permission의 반자동 선례와 일관. ✓
- S12 back: `- back`은 iOS 미지원 가능 → 엣지 스와이프 best-effort. 대안(좌상단 좌표 탭)은 더 브리틀 → 스와이프 채택.

### ④ 파일 계획
1. `.maestro/SCENARIOS.md` — S9~S15 (S8 다음)
2. yaml: `capture-empty`(S9)·`faq-multi`(S10)·`logout-cancel`(S11)·`profile-back`(S12)·`capture-add-page`(S13)·`capture-remove-page`(S14)
3. `checks.sh` 게이트

### ⑤ 위험
- 앱 코드 무변경이라 게이트/단위 영향 없음. e2e 실행은 로그인/피커 수동 → CI 완전 자동 아님(관측은 수동 세션에서).

### ⑥ 검증 계획
- `checks.sh` PASS(코드 무변경 확인).
- 가능하면 `maestro test`로 자동 4개(S9~S12) 관측, 반자동은 수동 단계 포함.

### 검증 결과 (VERIFY 후 채움)
- **게이트**: `checks.sh` ✅ ALL PASS(앱 코드 무변경 확인 — 시나리오/문서만).
- **작성물**: SCENARIOS.md S9~S15 + yaml 6개(capture-empty·faq-multi·logout-cancel·profile-back·capture-add-page·capture-remove-page). S15는 문서만.
- **assert 근거**: 실제 UI 문자열/접근성 라벨과 대조 확인(EmptyState·PageList·PageItem·FaqSection·ProfileScreen 코드 기준).
- **maestro 실행 관측 완료(2026-09-22, iPhone 17 Pro + 로컬 API/Postgres, 카카오 로그인 수동 후)**:
  - S9 capture-empty · S10 faq-multi(단일 열림) · S11 logout-cancel · S12 profile-back(엣지 스와이프) → **maestro 4/4 PASS**(모든 step COMPLETED). S12 iOS back 스와이프도 실측 성공.
  - S13 capture-add-page · S14 capture-remove-page → **피커 수동 선택으로 실측 PASS**(추가 시 "1페이지"/"분석하기"/"페이지 추가" 노출, 삭제 시 빈 상태 복귀). yaml은 반자동(피커 수동).
  - S15 드래그 → 문서만(미실행).
