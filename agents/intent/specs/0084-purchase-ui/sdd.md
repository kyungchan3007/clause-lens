# SDD — 앱 구매/복원 UI + 수명주기·폴링 (#165 Slice 4B, 앱)

- **관련 PRD**: 0084-purchase-ui/prd.md
- **상태**: draft (Codex 리뷰 2026-10-17 반영)

## 0. 범위·한계 (Codex 반영)
Codex 리뷰(세션 b01zi1wtq) 블로커 2·중대 5. 이 슬라이스 = **Fake 기반 앱 흐름**으로 한정(명시):
- 포함: 구독 포트 + Fake + **계정 coordinator**(직렬화·세대·single-flight) + **정직한 분리 상태** 확인 폴링 + SubscriptionScreen UI + 수명주기 배선.
- 제외(후속): 실 RevenueCat SDK 설치·네이티브 빌드 검증(배포 전) · 실 스토어 결제 검증(Slice 5) · **서버의 "이번 거래 반영" 확정 계약**(현재 없음 — 엔티틀먼트 반영+정직한 상태로 대체, 과제 기록).
- **배포 미설정 = 명확한 사용 불가**(Fake 자동선택 금지). Fake는 **명시적 개발 플래그**에서만.

## 1. 접근 방식 (Approach)

### 1-1. 구독 포트 + 어댑터 경계 — [B]
- `features/subscription/model/purchase-port.ts`: `PurchasePort` = `getOfferings()`·`purchase(planId)`·`restore()`·`configureAccount(userId)`·`logOut()`. 타입(Plan·PurchaseOutcome). 모두 공급자 "성공/취소/오류"만 — 권한 아님.
- `fake-purchases.ts`: dev/테스트. 주입된 offerings·결과. 네이티브 없음.
- `revenuecat-purchases.ts`: **실 어댑터 스텁** — 메서드가 `purchases_not_configured` throw. 실 SDK는 **lazy require**(최상위 import 금지) 자리만 주석으로. 설치·구현은 배포 전.
- `selectPurchasePort()`: `EXPO_PUBLIC_PURCHASES_FAKE==="1"`이면 Fake, 아니면 실 어댑터(미설정이면 스텁이 명확히 실패). **배포에서 키 없다고 Fake로 떨어지지 않음.**

### 1-2. 계정 coordinator — [블로커 C]
- `subscription-coordinator.ts`(모듈 단일 인스턴스): `generation`(세션 세대)·`currentUserId` 보유.
  - `setAccount(userId|null)`: userId 변경/로그아웃마다 `generation++` 후 `configureAccount`/`logOut`을 **직렬 큐**로. 변경 중 새 구매/복원 거부.
  - `run(op)`: 구매·복원·identify를 **single-flight**(계정별 1건)로 합침(중복 탭·자동 동기화 겹침 흡수). 시작 시 generation 캡처.
  - 결과 반영은 **캡처한 generation === 현재**일 때만(늦은 콜백·전환 후 결과 폐기). **늦은 콜백이 새 계정 토큰으로 identify 호출 금지**(generation 체크).
- `_layout` authed 레이어: `userId` 변경에 반응해 `setAccount(userId)`(마운트 1회 아님) + 최초 `identify`. 로그아웃에서 `setAccount(null)`.

### 1-3. 확인 흐름(정직한 분리 상태) — [블로커 A·중대 D]
- 상태: `idle · purchasing · confirming · active · delayed · error`(+ restore: `restoring · no_target · conflict`). **"이번 거래 완료"로 표현하지 않음** — "스토어 성공 / 서버 확인 중 / 현재 권한".
- purchase/restore 공급자 성공 → `POST /me/billing/identify`(멱등 재동기화 트리거) → `GET /me/access` **제한 폴링**(최대 N회·지수 백오프·**전체 마감 ~20s**·요청 타임아웃). `storage.canSave`(또는 analysis.source=subscription) 참이면 `active`.
  - 마감 초과 → `delayed`("스토어 처리는 됐고 서버 반영 확인이 지연"). **재확인 = identify+access 재개(재구매 아님).**
  - access는 **권한 UI 갱신**에만. identify.synced는 힌트(applied=0은 멱등일 수 있어 완료 단정 불가).
- 작업 수명은 **화면 바깥(coordinator, 계정별)**. 화면 이탈=관찰 중단이지 구매 취소 아님. 재진입 시 같은 작업 관찰.

### 1-4. restore·충돌 — [중대 E]
- restore: 공급자 조회 성공 → 서버 확인 흐름 동일. 결과 분리: 대상 없음(`no_target`)·확인 지연(`delayed`)·소유권 충돌(`conflict`).
- 충돌 안내(타 소유자·신원 비노출): "현재 계정에서 구매를 연결하지 못했습니다. 구매에 사용한 계정으로 로그인하거나 지원에 문의해 주세요."

### 1-5. UI — SubscriptionScreen
- `features/subscription/ui/SubscriptionScreen.tsx`: 플랜 카드·구독하기·복원·상태 배지/메시지(@clause-lens/ui: Button·Notice·MessageState·Screen). `SubscriptionPromoCard` CTA가 이 화면으로 이동(라우트 추가).
- 디자인 시스템·접근성 준수. 로딩/확인중/활성/지연/오류/충돌 각 상태 뷰.

### 1-6. 401 재시도 상호작용 — [중대 D]
- coordinator가 generation으로 결과를 폐기하므로, 갱신 대기 중 로그아웃·전환 시 늦은 응답은 무시. (shared client 401 로직은 이번 변경 안 함 — 한계로 기록: 서버 멱등성이 잘못된 계정 재전송을 막진 않음, generation 폐기로 UI/후속 호출만 차단.)

## 2. 고려한 대안
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| Fake 기반 앱 흐름 + 정직한 분리 상태 | 계정 없이 완성·오판 없음 | 실 SDK·거래 완료 계약 미검증(한계 명시) | ✅ |
| /me/access 변화로 "구매 완료" 판정 | 단순 | 기존 구독자 불변·오판(블로커 A) | ❌ |
| 세션 토큰 폐기만 | 쉬움 | SDK 계정 레이스 미방지(블로커 C) | ❌ |
| 실 SDK 설치까지 지금 | 통합 검증 | 계정 없음·prebuild·게이트 위험 | ❌(배포 전) |

## 3. 영향받는 코드
- 신규 `apps/mobile/src/features/subscription/{model,api,ui}/*`(포트·Fake·스텁·coordinator·useSubscription·billingApi·SubscriptionScreen) + 테스트.
- `SubscriptionPromoCard`(CTA → 라우트), 라우트 추가(app/subscription 또는 모달), `_layout` authed 배선(setAccount·identify).
- `packages/contracts` billing 재사용(4A). 서버 변경 없음.

## 4. 데이터 / 계약
- 앱이 `POST /me/billing/identify`·`GET /me/access` 소비. 신규 서버 계약 없음(거래 완료 계약은 후속 과제).

## 5. 위험과 완화
- R1. 거래 완료 오판(블로커 A) → 분리 상태·완료 단정 금지·access는 권한 갱신만. 서버 거래 확정 계약은 후속.
- R2. 계정 레이스(블로커 C) → coordinator 직렬화+generation 폐기. 한계(서버 재전송)는 기록.
- R3. 실 SDK 미검증(중대 B) → 결과를 "Fake 기반 흐름"으로 한정, 배포 미설정=사용 불가, 설치·네이티브 검증 후속.

## 6. 롤아웃 / 되돌리기
- 단일 PR(#165 4B → develop). 기능은 플래그/미설정이면 비활성(사용 불가 안내). 문제 시 CTA를 placeholder로 되돌림.

## 7. 검증
- 단위: 포트/Fake · coordinator(single-flight·세대 폐기·로그아웃·전환 중 거부) · useSubscription(확인 상태기계·마감·재확인=재구매 아님·취소/재진입) · SubscriptionScreen(상태별 렌더·구매/복원 상호작용·충돌 안내).
- 핵심 케이스(Codex F): 기존 구독자 추가 구매·서버 선반영 멱등(applied=0)·구매 중 계정 전환·확인 지연·복원 충돌·화면 재진입.
- 시나리오(maestro, Fake 대상 — 범위 명시).
- `bash agents/harness/evals/checks.sh` ALL PASS.
