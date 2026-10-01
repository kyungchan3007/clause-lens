# 작업 보드 (Task DAG) — 두 AI 공용

> **작업 전 여기서 태스크를 CLAIM** 하세요: `owner`를 자신(Claude/Codex)으로, `status`를 `in-progress`로.
> 완료 시 `done`으로 바꾸고 [JOURNAL.md](../JOURNAL.md)에 기록.
> status: `todo · in-progress · review · done · blocked`

## 규칙
- 상대 AI가 `in-progress`로 점유한 태스크의 파일은 건드리지 않는다.
- `depends`의 선행 태스크가 `done`이 되기 전 시작하지 않는다.
- 태스크는 가능하면 `task/<번호>-<슬러그>` 브랜치/worktree에서.

## 기반 (Phase 0) — 발판 구축, TASK-001 이전 선행

디자인 시스템·모노레포 스택은 [architecture.md § 디자인 시스템 & 모노레포](../context/architecture.md). 이 3개가 `done`이어야 기능 태스크 착수.

| id | 제목 | 산출물 | owner | status | depends |
| --- | --- | --- | --- | --- | --- |
| TASK-F1 | 모노레포 재구성 (Turborepo) | Expo 앱 → `apps/mobile`, Turborepo+pnpm workspace, `packages/config`, **Metro 모노레포 설정**(watchFolders·서버코드 제외), `apps/api`·`apps/worker`·`packages/contracts`는 자리만 | Claude | **done** | – |
| TASK-F1N | 네이티브 리빌드 검증 (분리) | 이동 후 `apps/mobile`에서 `pod install`(iOS)·Gradle 경로 확인 + 시뮬레이터 실제 실행. 깨지면 `expo prebuild --clean` | Claude | **done** (iOS) | TASK-F1 |
| TASK-F2 | 디자인 토큰 패키지 | `packages/tokens` — 3층 토큰(Cobalt #2563EB) + NativeWind preset + 폰트 | Claude | **done** | TASK-F1 |
| TASK-F3 | 공유 UI 패키지 | `packages/ui` — NativeWind + react-native-reusables 셋업, lucide `<Icon>` 래퍼, 기본 컴포넌트(Button 등) | Claude | **done** (NativeWind+Button 검증) | TASK-F2 |
| TASK-F3N | 아이콘 네이티브 리빌드 | `react-native-svg` 네이티브 포함 리빌드 → lucide `<Icon>` 실제 렌더 확인 (F1N처럼 별도) | Claude | **done** | TASK-F3 |

> `apps/api`(NestJS)·`apps/worker`·`packages/contracts`(zod 계약)는 서버 착수 시 채운다. F1은 **구조·자리만** 잡고 mobile만 실제 이동.

## 기능 태스크

| id | 제목 | 정의 (feature) | spec | owner | status | depends |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | 이미지 촬영·선택과 페이지 Draft 관리 | [capture-import](../intent/features/capture-import.md) | [0001](../intent/specs/0001-image-capture-and-draft.md) | Claude | **done** | TASK-F3 |
| TASK-002 | S3 Presigned URL 연동·직접 업로드 | [capture-import](../intent/features/capture-import.md) | [0018](../intent/specs/0018-uploads-presign.md)·[0019](../intent/specs/0019-app-upload.md) | Claude | **done** (백엔드 #15/PR#59·MinIO 실측 + 앱 #61/PR#62·시뮬레이터 실측, 2026-09-23) | TASK-001 |
| TASK-003 | 분석 요청·jobId 상태 폴링 | [analyze-document](../intent/features/analyze-document.md) | [0020](../intent/specs/0020-analysis-request-polling.md) | Claude | **done** (#63·PR#64 — 게이트 13검사·백엔드 실측 4/4·앱 시뮬 실측, 2026-09-28) | TASK-002 |
| TASK-004 | OCR·위험 조항 결과 + 하이라이트 표시 | [view-highlights](../intent/features/view-highlights.md) | [0021](../intent/specs/0021-ocr-risk-analysis.md)·[0022](../intent/specs/0022-app-result-highlight.md) | Claude | **done** (4a 백엔드 #68/PR#69 — Vision OCR+Claude · 4b 결과·하이라이트 #73/PR#75 — react-native-svg 오버레이·좌표변환·조항목록·S20 시뮬 실측, 2026-09-30. EXIF fixture 실측·재진입 영속은 후속) | TASK-003 |
| TASK-005 | 로그인·무료 분석 횟수 | [login-entitlement](../intent/features/login-entitlement.md) | [0009](../intent/specs/0009-app-kakao-login.md)(앱 로그인)·[0027](../intent/specs/0027-entitlement-enforcement/)(자격 집행)·[0029](../intent/specs/0029-app-entitlement-display/)(앱 표시) | Claude | **in-progress** (#36 앱 카카오 로그인 done · 정책 확정 #79 · **백엔드 집행 #90/PR#91 done** · **앱 잔량 표시·403 흐름 #94 in-progress** — Codex 설계 토론 반영) | #32 |
| TASK-008 | 분석 기록 재열람 — 문서목록 API + 7일 보관(접근 차단) | [save-retain](../intent/features/save-retain.md)(재열람 토대) | [0030](../intent/specs/0030-recall-documents-list/) | Claude | **done** (#96/PR#97 머지 — Codex 설계 토론 반영. **조항 재열람만**·접근 차단만. 이미지 하이라이트 재열람·실삭제(#74)는 바로 다음) | TASK-004·TASK-005 |
| TASK-006 | 구독·문서 저장 | [save-retain](../intent/features/save-retain.md) | – | – | todo | TASK-008 |
| TASK-007 | 특정 페이지 이미지 교체·재분석 | [replace-page](../intent/features/replace-page.md) | – | – | todo | TASK-003 |

## UI/UX 태스크 (14 페이지 "구현 순서")

로그인 이후 9개 화면 시안 확정(2026-10-01). 순서 0(공통 UI 정비)이 화면 리디자인(순서 1~5)의 선행. 착수 전 Codex 설계 토론 → 수렴안.

| id | 제목 | 정의 | spec | owner | status | depends |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-U0a | 디자인 토큰 정비 + 테마 경로(vars) + 위험도 tone 도메인 | 14 순서 0 | [0031](../intent/specs/0031-design-tokens-theme-path/) | Claude | **done** (#98/PR#99 머지 — vars() 테마 경로·대비 분리·riskTone 도메인) | TASK-F2·TASK-F3 |
| TASK-U0b1 | ListRow·Badge(tone)·StatusDot 신설 + DocumentRow/MenuRow 승격 + UI 테스트 게이트 | 14 순서 0 | [0032](../intent/specs/0032-listrow-badge-tone/) | Claude | **in-progress** (#100 — Codex 토론 반영) | TASK-U0a |
| TASK-U0b2 | Button·IconButton·SectionHeader·EmptyState + semantic.light 직접 참조 정리 | 14 순서 0 | [0034](../intent/specs/0034-button-iconbutton/) | Claude | **in-progress** (#101 — Codex 토론 반영) | TASK-U0b1 |
| TASK-U1 | 홈 화면 리디자인 (빈 상태·페이지 담음·최근) | 14 순서 1 | [0035](../intent/specs/0035-home-redesign/) | Claude | **done** (#106·#107 — 4상태·BrandHeader·Notice·card shadow·그리드 보류) | TASK-U0b2 |
| TASK-U2 | 분석 진행 화면 리디자인 (전용 ProcessingScreen) | 14 순서 2 | [0036](../intent/specs/0036-processing-screen/) | Claude | **done** (#108·PR#109 — 서버 계약 반영: indeterminate 흐르는 바·정직 문구 3곳) | TASK-U1 |
| TASK-U2b | 담은 페이지 2열 썸네일 그리드 (드래그 엔진 교체) | 14 순서 1 후속(②) | [0037](../intent/specs/0037-captured-pages-grid/) | Claude | **done** (#110·PR#111 — sortables Grid·fixed-order·ID-only 드롭·썸네일·미리보기 모달) | TASK-U2 |
| TASK-U1b | 홈 리디자인 보정 (Hero 아이콘·최근 진입 버튼·DocumentRow 상대일/플레이스홀더·중앙 Hero) | 14 순서 1 보정 | [0038](../intent/specs/0038-home-polish/) | Claude | **review** (#112/PR#113) | TASK-U2b |
| TASK-U4a | 구독 예고 UI — 무료 소진(403) 화면 + 최근 목록 구독 카드 | 14 ⑥·⑨ (구독 선반영) | [0039](../intent/specs/0039-subscription-ui/) | Claude | **in-progress** (#114 — 시안 선반영, 실구독=TASK-006) | TASK-U1b |
| TASK-U3~5 | 화면 리디자인 (결과·마이페이지·최근목록) | 14 순서 3~5 | – | – | todo | TASK-U2b |

> BrandHeader·Notice·card shadow는 선제 공통화하지 않고 **순서1(홈 리디자인)**에서 실제 소비 확인 후 도입(Codex·0012 승격 스펙).

> 위 태스크는 README "초기 개발 순서" + feature 정의를 DAG로 옮긴 시드입니다.
> 각 태스크의 **무엇/행동**은 연결된 feature 정의를 따르고, 별도 설계 판단이 필요하면
> [intent/specs/](../intent/specs/)에 spec을 추가합니다(TASK-001은 spec 0001 존재).

## 리팩토링 태스크 (마크업·로직 분리 — 커스텀 훅)

| id | 제목 | 정의 | spec | owner | status | depends |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-R1 | 홈 분석 세션 로직 커스텀 훅 분리 (app/index.tsx) | 라우트 얇게(frontend-architecture) | [0041](../intent/specs/0041-home-session-hook/) | Claude | **in-progress** (#118 — widgets/home-session · 단위·게이트 PASS · 로그인 후 e2e 확인 남음) | – |
| TASK-R2 | 결과 route 판정 로직 커스텀 훅 분리 (app/result.tsx) | 〃 | [0042](../intent/specs/0042-result-source-hook/) | Claude | **in-progress** (#119 — widgets/result-source · 단위·게이트 PASS · review 경로 시뮬 실측) | TASK-R1 |
| TASK-R3 | 프로필 화면 로직 커스텀 훅 분리 (ProfileScreen) | 〃 | – | – | todo (#120) | – |

## 테스트 자산 태스크

| id | 제목 | 정의 | spec | owner | status | depends |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-E1 | Maestro 시나리오 문구를 홈 리디자인 이후 UI로 동기화 | [SCENARIOS.md](../../apps/mobile/.maestro/SCENARIOS.md) | [0044](../intent/specs/0044-maestro-home-copy-sync/) | Claude | **in-progress** (#123 — 17 yaml + SCENARIOS 동기화 · 시뮬 11개 PASS · 게이트 PASS · PR 리뷰 대기) | TASK-U1b |

## 하네스·거버넌스 태스크

| id | 제목 | 정의 | spec | owner | status | depends |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-H1 | 이슈·체크박스 강제 장치 (하네스 이식 1/4) | [loop.md](../harness/loop.md) §브랜치·이슈 | [0023](../intent/specs/0023-issue-checkbox-enforcement.md) | Claude | **done** (#82/PR#86 머지 — records·issue-link·issue-sync·done 미체크 차단) | #77 |
| TASK-H2 | 커밋 기록 규칙 (하네스 이식 2/4) | [commit-and-issue.md](../harness/commit-and-issue.md) | [0024](../intent/specs/0024-commit-record-rules.md) | Claude | **done** (#83/PR#87 머지 — 커밋 세 섹션 hook·토큰 자동 기입) | #82 |
| TASK-H3 | 작업 과정 기록·강제 (하네스 이식 3/4) | [commit-and-issue.md](../harness/commit-and-issue.md) | [0025](../intent/specs/0025-process-record-enforcement/) | Claude | **done** (#84/PR#88 머지 — 폴더 spec·자동기록·수정전 차단·종료 돌려보냄) | #82 |
| TASK-H4 | 복기 자동 주입 + 효과 측정 (하네스 이식 4/4) | [commit-and-issue.md](../harness/commit-and-issue.md) | [0026](../intent/specs/0026-recall-injection/) | Claude | **in-progress** (#85 — 복기 주입·pnpm metrics · 효과 측정은 후속) | #83·#84 |
| TASK-H5 | Notion 기록 규칙 지침서화 (영향 섹션 전체 갱신·섹션 맵) | [notion-recording.md](../harness/notion-recording.md) | [0033](../intent/specs/0033-notion-recording-rule/) | Claude | **in-progress** (#103 — 사용자 지적: 01 편중 금지·03/15 누락) | – |

## 백로그 (아직 태스크화 안 됨)
- TanStack Query 도입 (서버 상태 캐시)
- Zustand store 구조 확정
- 에러/재시도 UX 공통 컴포넌트
- `MenuRow`/`ListRow`를 `packages/ui`로 승격 (shared-first 정책상 제네릭 UI = 승격 대상. 현재 profile에 인라인 — 다음 UI 작업 시 이동)
