# 0043 — 프로필 화면 로직 커스텀 훅 분리 — SDD

> **관련 PRD**: prd.md · **이슈:** #120 · **갱신**: 2026-10-02

## 0. 읽은 문서
- frontend-architecture(레이어·세그먼트·import 방향), spec 0041·0042(같은 시리즈), loop.md

## 1. 접근
```
features/profile/
  lib/providerLabel.ts          providerLabelOf (순수)
  lib/providerLabel.test.ts
  model/useProfile.ts           구독·포커스 재조회·액션
  model/useProfile.test.ts
  ui/ProfileScreen.tsx          렌더 전용
```
- `useProfile()` 반환: `{ displayName?, providerLabel, confirmSignOut, openInquiry }`
  - `useFocusEffect`로 잔량 재조회(스택 화면은 언마운트되지 않으므로 mount effect가 아니라 focus — 기존과 동일).
  - "사용자" 폴백·"…계정으로 로그인" 문구는 표시 카피라 UI에 유지.

## 2. 고려한 대안
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| `widgets/`에 훅(#118·#119처럼) | 교차 조합 정위치 | ProfileScreen(features)이 widgets를 import → **역방향 import 위반** | ❌ |
| `features/profile/model/useProfile` | ui→model 같은 슬라이스, 방향 OK, 이슈 범위와 일치 | auth·entitlement 교차 import가 model에 남음(기존 ui에 있던 것 이동, 신규 아님) | ✅ |
| ProfileScreen째 widgets로 이동 | FSD 완전 준수 | 동작 불변 리팩토링 범위 초과·라우트/배럴 변경 | ❌(N2 후속) |
| 확인 Alert를 UI에 남기고 signOut만 훅 | Alert=UI라는 관점 | 화면 컴포넌트가 다시 명령형 API를 앎, 테스트 분산 | ❌ |

## 3. 영향받는 코드
- 신규: `features/profile/lib/providerLabel.ts`·`model/useProfile.ts` (+ 테스트) · 변경: `ui/ProfileScreen.tsx` · 새 의존성 없음.

## 5. 위험과 완화
- R1 포커스 재조회 누락 → 훅 테스트(useFocusEffect 콜백에서 refresh 호출).
- R2 로그아웃 확인 없이 즉시 signOut → 훅 테스트(확인 버튼에서만 호출).

## 6. 롤아웃 / 되돌리기
- 단일 PR. 문제 시 revert(동작 불변).

## 7. 검증
- 단위: 순수 함수 표 기반 + 훅(renderHook, expo-router useFocusEffect mock, auth·entitlement 배럴 mock).
- 게이트 `checks.sh`. e2e: profile.yaml·logout-cancel.yaml(로그인 상태 시뮬).

## 검증 결과 (2026-10-02)
- 단위: `providerLabelOf` 3 · `useProfile` 6 → 9 추가(profile 전체 11) PASS. 타입체크 PASS.
- 게이트 `checks.sh`: Task records(folder) 외 전 항목 PASS. 실패 원인은 로컬 잔재 폴더 `specs/0042-result-source-hook/`(#119 브랜치의 git 미추적 trace.auto.jsonl만 남음) — 코드와 무관 → 사용자가 폴더 삭제 후 재실행 **ALL PASS**(모바일 단위 190).
- e2e(Maestro, 로그인 상태 시뮬): `profile`(이름·카카오 라벨·잔량·FAQ 펼침/접힘·1:1 문의 준비 중) · `logout-cancel`(확인 다이얼로그 → 취소 → 프로필 유지) **둘 다 PASS**. 원본 yaml의 홈 대기 문구("계약서를 담아주세요")가 리디자인 전이라 대기 줄만 "계약서, 찍기만 하세요"로 바꾼 임시 사본으로 실행. `logout.yaml`은 실제 로그아웃이라 미실행.
