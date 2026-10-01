# 0029 — 무료 분석 잔량 표시 + 403 흐름 (앱) — SDD

> **관련 PRD**: prd.md · **이슈:** #94

## 1. 접근 (Approach)
`features/entitlement/` 기능 폴더를 신설해, 서버 `GET /me/entitlement`를 조회·표시하고, 분석 접수 403을 quota 안내로 분기한다. 상태는 zustand store(수동) — 단, **계정 격리·겹친 refresh·갱신 트리거**를 Codex 토론 결과대로 설계한다.

- **api** `entitlementApi.ts`: `fetchEntitlement(token)` → GET, `entitlementResponseSchema.parse`, 실패 시 공유 `HttpError`.
- **model** `entitlementStore.ts`(zustand): `{ status: idle|loading|ready|error, data, staleError }` + `refresh()`.
  - **계정 격리**: refresh 시작 시 현재 userId(또는 세션 세대) 캡처 → 응답/에러 반영 전 현재 값과 비교, 다르면 폐기. 로그아웃·계정 변경 시 세대 증가 + data/error 제거(토큰 갱신(같은 userId)과 구분 — 그땐 유지).
  - **겹침 직렬화**: 요청 in-flight면 "pending 재조회" 플래그만 세우고, 완료 후 한 번 더 조회. 늦게 온 과거 응답이 최신을 못 덮게 세대로 가드.
  - **표시 정책**: 최초 loading=스피너(0 대체 금지) · 최초 error="불러오지 못했어요"+재시도 · 재조회 중=기존 값 유지 · 재조회 실패=기존 값 + staleError 표시.
- **ui** `FreeQuotaRow.tsx`: store를 구독해 "남은 무료 분석 N회" / 로딩 / 에러 표시. ProfileScreen 내 정보 영역에 배치.
- **403 분기**: `useAnalysis` catch에서 `err instanceof HttpError && err.status===403` → phase=error, message="현재 사용할 수 있는 무료 분석 횟수가 없어요" + entitlement `refresh()`(실패해도 분석 phase에 영향 없음). 그 외(404·409·네트워크)는 기존 "분석 요청에 실패했어요" 유지.
- **갱신 배선**: 인증 복원·로그인·계정변경(인증↔entitlement 연결 상위 계층, setSession 직접 import 금지) · 접수 성공 직후 · 분석 terminal 전환당 1회 · 403 · ProfileScreen 포커스/foreground.
- **HttpError 승격**: analysisApi의 `HttpError`를 공유 lib(`shared/http` 또는 `features/.../lib`)로 옮겨 analysis·entitlement가 **동일 클래스**를 import(기존 instanceof 유지).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| TanStack Query 도입 | 서버 상태·무효화 표준 | 단일 조회에 과함·인증 연동 확대 | ❌ (백로그) |
| 수동 zustand store + refresh | 기존 패턴·가벼움 | 격리·겹침 규칙 직접 구현 | ✅ |
| 403=quota를 공유 HttpError에 각인 | 간단 | 다른 403을 quota로 오인 | ❌ → 접수 API 한정 분기 |
| terminal에서만 갱신 | 단순 | 예약(접수) 시점 잔량 변화 누락 | ❌ → 접수·terminal·403 모두 |
| 앱이 잔량 −1 선반영 | 즉각 반응 | 서버와 어긋남·오판 | ❌ → 서버 값만 표시 |

## 3. 영향받는 코드 (Touched Surface)
- `apps/mobile/src/features/entitlement/`(신규): api·model(+test)·ui·index.
- `apps/mobile/src/features/analysis/model/useAnalysis.ts`: 403 분기 + 접수 성공/terminal 시 entitlement refresh.
- `apps/mobile/src/features/analysis/api/analysisApi.ts` → `HttpError` 공유 lib로 이동(import 경로 갱신).
- `apps/mobile/src/features/profile/ui/ProfileScreen.tsx`: FreeQuotaRow 배치 + 포커스 refresh.
- 인증 연결: 로그인/계정변경 시 entitlement refresh·초기화 배선(상위 계층).
- e2e 시나리오(.maestro) + 단위 테스트.

## 4. 검증 (Verification)
- **단위**: 응답 계정 격리(A 요청이 B 로그인 후 완료돼도 무시) · 겹친 refresh 누락 없음 · zod 검증 실패·재조회 실패 처리 · analyze **403만** quota 분기(404·409·네트워크 구분) · 로그아웃 시 store 초기화.
- **e2e**: 프로필 잔량 표시 · 접수/종료 후 갱신 · 403 안내 · 로그아웃·계정 전환 시 이전 값 미노출.
- **게이트**: `bash agents/harness/evals/checks.sh` PASS(타입·단위·expo-doctor·기록).

## 5. 리스크 / 롤백
- 서버가 terminal 응답 전에 잔량 확정을 안 하면 즉시 GET이 stale일 수 있음 → terminal 후 refresh + 프로필 포커스 refresh로 보정(필요 시 짧은 재조회).
- 신규 기능 폴더·배선뿐 — 문제 시 FreeQuotaRow 미표시·403 분기 제거로 롤백 가능.
