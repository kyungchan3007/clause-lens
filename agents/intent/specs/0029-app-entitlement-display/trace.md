# 0029 — 과정 기록 (trace)

## 판단
- **착수 전 Codex 설계 토론**(사용자 워크플로우): 구현 전에 설계를 Codex와 교차검증. 핵심 반영:
  - **잔량은 접수(예약) 시점에도 변함** → 갱신 트리거에 접수 성공·403 포함(terminal만으로 부족).
  - **403 문구 완화**: 예약(freeReserved) 때문일 수 있어 "모두 사용" 대신 "현재 사용할 수 있는 무료 분석 횟수가 없어요". 구독 CTA 금지.
  - **계정·세션 격리**: 비동기 응답을 세대 비교로 폐기, 토큰 갱신과 계정 변경 구분.
  - **겹친 refresh 직렬화** + entitlement 실패가 분석 접수를 실패시키지 않음.
  - **로딩/실패 표시 정책**(0 대체 금지), 캐시 0으로 분석 선제 차단 금지.
  - 현행 유지: 기능폴더+zod, zustand, ProfileScreen, HttpError 승격, 구독/CTA=TASK-006.
- **403=quota**: 접수 API는 소유권=404·업로드전=409라 403은 사실상 quota. 접수 API 한정 분기로 처리(공유 HttpError엔 각인 안 함).

## 막힘 / 되돌림
- **기능 간 결합 위치**: 아키텍처상 "기능끼리 직접 참조 금지, 조합은 상위 레이어". analysis가 entitlement를 import하면 위반 → **상위 동기화 훅 `useEntitlementSync`**(루트 `_layout` AuthGate에 마운트)가 useAuthStore·useAnalysisStore를 구독해 잔량 갱신을 조율. useAnalysis는 403 **문구만** 바꾸고(entitlement import 없음), 갱신은 phase 변화로 훅이 수행.
- **HttpError 공유**: analysis·upload에 HttpError가 각각 중복 정의돼 있었음. analysis 것만 공유 `src/shared/http.ts`로 승격·재노출(entitlement도 같은 클래스 사용). upload은 범위 밖이라 그대로.
- **403 테스트의 auto-mock 함정**: `jest.mock("../api/analysisApi")` 자동목이 HttpError도 목으로 바꿔 `instanceof`·`status`가 깨짐 → 명시 팩토리로 **HttpError는 실제 공유 클래스 유지**, 함수만 jest.fn().
- **되돌림 없음** — Codex 토론 설계대로 진행. e2e 403·계정전환 실측은 백엔드 잔량 seeding·시뮬레이터 필요 → 후속.
