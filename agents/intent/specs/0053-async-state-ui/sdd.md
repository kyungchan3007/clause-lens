# SDD — 비동기 상태(로딩·에러-재시도) 인라인 UI 공통화

> **관련 PRD:** 0053-async-state-ui/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
"표현만 공통화, 판정은 호출부" 원칙. 4곳이 복붙하던 두 조각 — 로딩 스피너와 에러 재시도 컨트롤 — 을 `packages/ui`로 올리되, **status 판정·refresh 바인딩·바깥 컨테이너는 호출부가 그대로 소유**한다. 승격 전 4곳을 정독해 로딩 표시·에러 문구·onPress·a11y 라벨을 **1:1 대조**하고, 차이는 통일하지 않고 props로 재현한다.

- **두 컴포넌트로 분리 (G1)** — 소비처가 이미 `loading/error/ready/idle` 등 자체 status로 분기하므로, `status` 하나를 받는 단일 컴포넌트는 반대 분기에서 빈 라벨(dead prop)을 강요한다. 그래서 책임별 2개로 분리:
  - `LoadingIndicator({ label, size? })` → `<ActivityIndicator size accessibilityLabel={label} />`. RN 1:1 래퍼지만 **"스피너는 a11y 라벨 필수"** 규칙을 타입으로 강제(label required). size 미지정 시 RN 기본 "small".
  - `RetryInline({ onRetry, label, className?, textClassName?, accessibilityLabel?, hitSlop?, children? })` → `<Pressable accessibilityRole="button" accessibilityLabel onPress={onRetry} hitSlop className>{children ?? <Text className={textClassName ?? "text-sm text-danger"}>{label}</Text>}</Pressable>`.
- **차이 흡수 매핑 (G3)** — 4곳의 미세차를 props로 표현(억지 통일 금지):
  - FreeQuotaRow: 기본형. `<RetryInline onRetry label />` → 컨테이너/라벨/hitSlop 없음(모두 undefined = 원본과 동일).
  - FreeQuotaChip: 에러 표시가 danger **Badge**(텍스트 아님) → `children`에 Badge 주입, `accessibilityLabel`·`hitSlop={8}`·`className="self-start active:opacity-60"` 유지. 로딩은 `size="small"`.
  - RecentEntryButton: 카드 스타일 Pressable → `className="items-center rounded-2xl border border-border bg-surface py-4 active:opacity-70"`. 바깥 `px-5 pt-2` View는 호출부 유지.
  - RecentListScreen: 에러가 **메시지 Text + filled 버튼** 2요소 → 메시지 Text는 호출부에 남기고, 버튼만 `RetryInline`(className=filled primary, `textClassName="text-sm font-semibold text-white"`). 푸터 "더 불러오는 중" 스피너도 `LoadingIndicator`로.
- **레이어 (N2)** — ui는 표시 전용. status 판정·`refresh()`는 호출부가 바인딩해 `onRetry`로 전달. ui는 스토어를 모른다(결합 0).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. `LoadingIndicator` + `RetryInline` 2컴포넌트, 차이는 props | dead prop 0, 1:1 재현 쉬움, 책임 분리 | 컴포넌트 2개 | ✅ |
| B. `AsyncState({ status, loadingLabel, errorLabel, onRetry })` 단일 | 1컴포넌트 | 소비처가 ready/idle도 분기 → 반대 가지에서 빈 라벨 강요(dead prop), API 비대 | ❌ |
| C. 에러도 `RetryInline` 고정 danger 텍스트만 | API 최소 | Chip(Badge)·List(filled white)를 재현 못 함 → 억지 통일 or 미적용 | ❌ |
| D. `LoadingIndicator` 생략하고 ActivityIndicator 직접 유지 | 래퍼 0 | a11y 라벨 누락 drift 재발, 로딩 테스트 대상 없음 | ❌ |

## 3. 검증 (Verification)
- 4곳 정독 후 로딩/에러 조각을 props로 1:1 대조 — danger 텍스트(`text-sm text-danger`)·filled(`text-sm font-semibold text-white`)·Badge 세 변형이 원본 className/문구/onPress/a11y와 동일함을 코드로 확인.
- `undefined` props(className·hitSlop·accessibilityLabel 미지정)가 원본의 "해당 prop 없음"과 렌더 동치임을 확인(FreeQuotaRow 기본형).
- 공통 컴포넌트 단위 테스트 추가: 로딩(ActivityIndicator + 라벨·size) · 에러-재시도(onPress→onRetry 호출·danger 텍스트) · a11y(accessibilityRole=button·accessibilityLabel) · children/textClassName 오버라이드.
- 기존 `FreeQuotaChip`·`RecentEntryButton` 테스트 무수정 통과(스피너 1개·button role·"다시 시도" 텍스트 그대로).
- 게이트: contracts/db/infra 빌드 → ui/mobile typecheck → ui/mobile 유닛 → `checks.sh` ALL PASS.
