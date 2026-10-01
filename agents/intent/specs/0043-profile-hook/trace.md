# 0043 — 과정 기록 (trace)

## 판단
- 사용자: "#120 프로필도 같은 방식으로 진행" — 0041·0042 시리즈 마지막.
- #122(#119) 아직 OPEN이지만 코드 의존 없음 → develop에서 브랜치. **브랜치 전환 후 ProfileScreen 재읽기**.
- 위치: #118·#119와 달리 widgets 불가 — ProfileScreen이 features 레이어라 widgets 훅을 import하면 역방향. → `features/profile/model`(이슈 범위 그대로). 기존 ui의 auth·entitlement 교차 import는 model로 옮겨질 뿐 신규 아님 → [허점]에 기록, 화면째 상위 이동은 후속.
- e2e: logout.yaml은 실제 로그아웃시켜 사용자 재로그인(카카오 수동)이 필요 → 실행 안 함. logout-cancel·profile만.

- 문의 Alert도 훅으로(`openInquiry`) — 화면이 명령형 API를 모르게.
- "사용자" 폴백·"…계정으로 로그인"은 표시 카피라 UI 유지.

## 막힘 / 되돌림
- 타입체크 FAIL: 서버 `SessionUser.displayName`은 `string | null`인데 훅 반환을 `string | undefined`로 좁혀 잡음 → `string | null`로 넓힘 + null 테스트 추가. (jest는 타입 검사를 안 해서 단위는 통과했었음)
- 루트에서 `--rootDir`로 jest 실행 시 useProfile 테스트 FAIL로 보였으나 앱 폴더 기준 실행은 PASS — 실행 설정 차이(오탐), 게이트 단위 테스트도 PASS.
- 게이트 Task records FAIL: 브랜치 전환 잔재 `specs/0042-result-source-hook/`(trace.auto.jsonl만) — 0039 유령 폴더와 같은 현상. scratchpad로 이동 시도가 권한 검사(로컬 파괴)에 막힘 → 사용자 정리 대기.
- 사용자가 `rm -r specs/0042-result-source-hook` 실행(실제 spec은 #119 브랜치에 커밋돼 있음) → 게이트 ALL PASS.
