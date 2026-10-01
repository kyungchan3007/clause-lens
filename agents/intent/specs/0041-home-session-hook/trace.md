# 0041 — 과정 기록 (trace)

## 판단
- 사용자: "tsx에 HTML(마크업)과 비즈니스 로직이 섞여 있다 → 웹처럼 커스텀 훅으로 모듈화". RN도 동일 패턴(커스텀 훅/ViewModel 훅)으로 합의.
- 진단: index.tsx(최심)·result.tsx(중)·ProfileScreen(경). ResultScreen·IndeterminateBar·DocScanGraphic의 useState는 순수 뷰 상태라 유지.
- 사용자 지시: index.tsx부터, **도메인마다 이슈+브랜치** → #118(홈 세션)·#119(결과)·#120(프로필) 생성, #118부터.
- 사용자 지시: **Notion 작업 안 함** — 내일 사용자가 이슈·커밋 기록으로 직접 정리. 이슈·커밋에 충분히 기록.
- Codex 설계 토론: 사용자가 바로 진행 지시 → 생략(동작 불변 리팩토링).
- 위치: FSD 교차 조합 → `src/widgets/home-session/`(widgets 첫 도입). 네비게이션은 route에 유지.

- getAuth·snapshots를 훅 밖 모듈 스코프로: 스토어를 getState()로 호출 시점 조회하므로 의미 동일, effect의 eslint 예외 주석 불필요해짐.
- 테스트: 기능 배럴(capture·auth)이 reanimated·카카오 네이티브를 끌어와 jest 실패 → 테스트에서 배럴을 스토어만 노출하도록 mock.

## 막힘 / 되돌림
- **index.tsx 덮어쓰기로 #114 무료 소진 분기 누락(자체 발견·복구)**: 진단 시 이전 브랜치(fix/116)의 index.tsx를 읽고, develop 기반 새 브랜치에서 그 기억으로 파일 전체를 Write → develop에 들어온 #114 `errorKind="quota"` → `QuotaExceededScreen` 분기가 사라짐. **게이트는 ALL PASS**(해당 분기 테스트 부재). JOURNAL 읽다 발견 → develop 원본과 diff로 차이가 quota 분기뿐임을 확인 후 복구 + mergeSessionPhase·훅 회귀 테스트 추가.
  - 교훈: 브랜치 전환 후엔 수정 대상 파일을 **다시 읽고** 편집. route 렌더 분기는 단위 테스트가 없어 게이트가 못 잡음.
- e2e: 시뮬레이터 로그아웃 상태 → 로그인 이후 시나리오 실행 불가(카카오 자격증명 수동).
- `gh issue create --label refactor` 실패(저장소에 refactor 라벨 없음) → 라벨 없이 생성.
