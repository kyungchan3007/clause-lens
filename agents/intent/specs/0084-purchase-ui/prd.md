# PRD — 앱 구매/복원 UI + 수명주기·폴링 (#165 Slice 4B, 앱)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-17
- **이슈:** #165 (TASK-006 ④)
- **관련**: 서버 Slice 1~4A 머지 완료(동기화·웹훅·재시도/대사·identify). 이 슬라이스 = 앱 결제 흐름. 설계: ADR-12 + Codex(2026-10-17 4·4B 리뷰).

## 1. 문제 (Problem)
- 서버 결제 파이프라인은 완성됐지만 앱엔 구독 상품·구매·복원 UI가 없다(`SubscriptionPromoCard`는 "곧 제공" placeholder).
- 구매 성공(클라)과 권한(서버 판정)이 분리돼야 하며, 계정 전환·폴링 취소 등 수명주기 처리가 필요.

## 2. 목표 (Goals)
- G1. **구독 포트** — `getOfferings·purchase·restore` 추상화 + Fake(기본) + 실 RevenueCat 어댑터(네이티브 로딩 경계 분리).
- G2. **계정 수명주기** — 로그인 시 공급자 식별(configure) + `POST /me/billing/identify` 1회, 로그아웃 시 정리 + 진행 중 구매/폴링 세션 폐기.
- G3. **구매↔권한 분리** — 구매/복원 성공 후 identify(재동기화 트리거) → `/me/access` 제한 폴링(상한·취소)으로 서버 반영 확인.
- G4. **구독 화면** — placeholder 교체: 플랜·구독·복원·상태(로딩/확인중/활성/지연/오류). 디자인 시스템.
- 계정·스토어 없이 Fake로 완성(실 SDK·결제는 배포). Google 먼저·코드 iOS 동등.

## 3. 목표가 아닌 것 (Non-goals)
- N1. (Codex 범위 결정 대기) 실 네이티브 SDK 설치·prebuild·실 결제 검증 — 스토어 계정 준비 시 배포 전.
- N2. 구매 소유권 증명(영수증 검증/secure logIn) — 출시 전 과제(4A에서 분리).
- N3. 샌드박스 양 플랫폼 출시 검증 → Slice 5.

## 4. 사용자 흐름 (User Flow)
로그인 → 공급자 식별 + identify(매핑) → 구독 화면 "구독하기" → 스토어 결제 → identify 재동기화 트리거 → /me/access 폴링 "구매 확인 중" → 반영되면 보관 권한 UI. 복원도 동일 확인. 로그아웃/이탈 시 폴링 취소.

## 5. 성공 지표
- 구매/복원 성공 후 서버 반영까지 "확인 중", 반영 시 권한 UI 갱신, 상한 초과 시 "확인 지연" + 재확인.
- 로그아웃/계정 전환에 이전 결과가 새 UI에 안 샘.
- `checks.sh` ALL PASS + 앱 단위/시나리오.

### Acceptance (Fake 기반 앱 흐름)
- [x] 구독 포트 + Fake + 실 어댑터 스텁(네이티브 lazy·미설정=사용불가·Fake 자동선택 금지)
- [x] 계정 coordinator(userId 변경 반응·세대/single-flight·로그아웃 무효화·늦은 콜백 차단)
- [x] 확인 흐름 정직한 분리 상태(스토어 성공/서버 확인중/권한) + 제한 폴링(상한·전체마감·재확인=재구매 아님)
- [x] restore 분리(no_target/delayed/conflict 중립 안내)
- [x] SubscriptionScreen(placeholder CTA 교체) + `_layout` 배선
- [x] 단위(coordinator·상태기계·UI, Codex 핵심 케이스 20건) + maestro 시나리오(S23, Fake 빌드 실행은 후속)
- [x] `checks.sh` ALL PASS

## 6. 제약
- 서버가 진실. 구매 성공만으로 권한 X. 토큰·URL 로그 금지. 공유 UI shared-first. 비밀값 env.

## 7. 애매한 곳·가정 (Open Questions)
- 완료 판정: /me/access·identify.synced만으론 "이번 거래" 완료 단정 불가 → **분리 상태**(스토어 성공/서버 확인중/권한)로 표현, 거래 확정 서버 계약은 후속 과제 (확인됨: Codex 블로커 A)
- 네이티브 SDK 설치는 **보류**(계정 없음·게이트 안정) → Fake 기반 흐름으로 한정, 배포 미설정=사용불가 (확인됨: Codex 중대 B는 경미한 분할 선택으로 수용)
- 수명주기: 세션 폐기만으론 부족 → **coordinator 직렬화+generation 폐기** (확인됨: Codex 블로커 C)
- 이전 정책: 기존 소유자 유지 — restore 충돌은 중립 안내 (확인됨: 4A에서 사용자 확정)
