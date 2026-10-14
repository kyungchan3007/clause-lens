# PRD — 디자인 시스템 최적화: 공용 승격 + 토큰화

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-15
- **이슈:** #196
- **관련 태스크**: 디자인 시스템·FSD (shared-first 승격)

## 1. 문제 (Problem)
앱(`apps/mobile`)에 공용 디자인 시스템(`packages/ui`·`packages/tokens`)으로 올라가야 할 중복 UI와, 토큰을 우회한 하드코딩 값이 남아 있다. 전수 스캔 결과: ① 아이콘 배지를 여러 화면이 손으로 재구현(공용 `IconBadge`가 rigid해 못 씀) ② 라우트마다 SafeAreaView 셸 중복 ③ `text-white`·`borderRadius:999`·scrim `rgba(...)` 등 토큰 미적용.

## 2. 목표 (Goals)
- G1. `IconBadge`에 크기·모양 프롭을 추가(기본값=현행)해 일반화하고, 앱의 손그림 배지를 공용으로 승격.
- G2. 공용 `Screen` 래퍼를 신설해 라우트 SafeAreaView 셸 중복을 제거.
- G3. 시각 변화 없는 토큰화 3건(primary-foreground·radius.full·overlay.scrim).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 폰트 스케일 밖 크기(11/13/15/17/22px) 처리 — 스냅/확장은 시각 결정이라 후속 이슈.
- N2. 메시지/에러 상태 컴포넌트화·RetryInline→Button 재구성 — 시각/구조 변경이라 후속.
- N3. 다크 테마 활성화 등 동작 변경 아님(기본값·시각 보존).

## 4. 사용자 흐름 (User Flow)
사용자 화면은 **그대로**(시각 불변). 개발자는 배지·셸을 공용 컴포넌트로 일관되게 쓰고, 토큰이 단일 소스가 된다.

## 5. 성공 지표 (Success Metrics)
- ProcessingScreen·QuotaExceeded·Hero가 공용 `IconBadge` 사용(손그림 제거).
- 라우트 셸이 공용 `Screen` 사용.
- 하드코딩 색/반경 리터럴 3건이 토큰 참조로 대체.

## 6. 제약 (Constraints)
동작·시각 보존이 최우선(자율 머지). NativeWind 정적 클래스 유지(동적 className 금지). 기본 프롭은 현행과 바이트 동일한 클래스로 매핑. 게이트 통과가 머지 조건.

### Acceptance
- [x] `IconBadge` box·shape 프롭 추가(기본=md·circle=현행) + ProcessingScreen·QuotaExceeded·Hero 승격
- [x] 공용 `Screen` 래퍼 신설 + 라우트 셸 대체
- [x] 토큰화 3건(text-primary-foreground·radius.full·overlay.scrim)
- [x] `bash agents/harness/evals/checks.sh` ALL PASS
- [x] 폰트 스케일·메시지 상태 등은 후속 이슈로 분리 기록

## 7. 애매한 곳·가정 (Open Questions)
- "최적화/승격/토큰화"의 안전 범위를 시각 불변 변경으로 한정하고, 외형이 바뀌는 판단(폰트 스케일 스냅·메시지 상태 컴포넌트화)은 후속 이슈로 분리함 — 사용자 취침 중이라 깨어난 뒤 결정 (가정)
