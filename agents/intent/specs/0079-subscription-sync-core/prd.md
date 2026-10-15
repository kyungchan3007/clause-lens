# PRD — 구독 동기화 핵심 (서버, #165 Slice 1)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-15
- **이슈:** #165 (TASK-006 ④)
- **관련 태스크**: 인앱결제 IAP+RevenueCat — 첫 서버 슬라이스. 설계: ADR-12 + Codex 2026-10-15 토론.

## 1. 문제 (Problem)
#162가 `Subscription` 모델·판정·`GET /me/access`를 깔았지만, **구독 행을 생성·검증하는 서버 로직이 없다**(행은 #165가 생성). #165는 큰 기능이라 5슬라이스로 나누고, 이 슬라이스는 **외부 계정·실연결 없이 모킹 단위테스트로 완성 가능한 "동기화 핵심"** 만 다룬다.
추가로 현재 `subscription-ops`의 `grace`가 **기한 없이 무조건 유효** → 만료 알림 누락 시 권한이 영원히 유지되는 버그가 있다(Codex 지적).

## 2. 목표 (Goals)
- G1. `grace` 유예에 **종료 기한**(`gracePeriodEnd`)을 둬 `grace && gracePeriodEnd > now`로 제한(버그 수정).
- G2. **이벤트 수신함**(`SubscriptionEvent`)·**고객 매핑**(`BillingCustomer`) 모델 + 마이그레이션.
- G3. **순수 도메인 로직**: 공급자 스냅샷 → Subscription 투영(정규화), 소유권 충돌 판정, 늦은(stale) 쓰기 차단(펜싱).
- G4. `BillingProviderPort`(외부 조회 추상화) + **Fake** + 이 포트를 쓰는 **동기화 서비스**(멱등·충돌·stale 방어). Fake 공급자·저장소·시계로 단위테스트.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 실제 RevenueCat REST 어댑터·웹훅 인증/수신·재시도 실행 → Slice 2.
- N2. 대사 스케줄러·누락 탐지·운영 알림 → Slice 3.
- N3. 앱 어댑터·구매/복원 UI → Slice 4. · N4. 샌드박스 출시 검증 → Slice 5.
- N5. 운영 웹훅 엔드포인트(라우트) 노출 — 이 슬라이스는 **비활성**(서비스는 있으나 라우트 미연결).

## 4. 사용자 흐름 (User Flow)
(서버 관점) 공급자 이벤트 수신 → 수신함 멱등 저장 → **공급자 현재 상태 재조회** → 정규화 → `Subscription` 반영(소유권 충돌 거부·stale 차단). 권한은 기존 `GET /me/access`가 저장된 구독을 읽어 판정(불변).

## 5. 성공 지표 (Success Metrics)
- 핵심 테스트 통과: 중복 이벤트·과거 이벤트 늦은 도착·오래된 조회 늦은 완료(stale)·타 계정 귀속(충돌)·유예 만료·공급자 장애(조회 실패 시 기존 기한만 인정).
- `grace`는 `gracePeriodEnd` 경과 시 무효.
- `bash agents/harness/evals/checks.sh` ALL PASS.

## 6. 제약 (Constraints)
- 서버가 진실. 앱 성공만으로 권한 X. **웹훅=재조회 트리거**, 행=검증된 현재 상태의 투영.
- iOS·Android 양 플랫폼 불문(코드). 외부 계정 없이 모킹으로 완성.
- `event_timestamp_ms`/eventId로 순서 보장 금지 → 고객별 직렬화 + verifiedAt 펜싱.
- 비밀값 env. 알 수 없는 이벤트는 기록하되 권한 미부여.

### Acceptance
- [x] `gracePeriodEnd` 추가 + `grace && gracePeriodEnd > now` 로 판정(기존 테스트 갱신)
- [x] `SubscriptionEvent`·`BillingCustomer` 모델 + 수기 마이그레이션 SQL
- [x] 순수 로직: 정규화(normalizeProviderSnapshot)·소유권(resolveOwnership)·stale 차단(isStaleWrite) + 단위
- [x] `BillingProviderPort` + Fake + 동기화 서비스(멱등·충돌·stale) + Fake 단위테스트(핵심 6케이스)
- [x] `bash agents/harness/evals/checks.sh` ALL PASS

## 7. 애매한 곳·가정 (Open Questions)
- 소유권 정책은 RevenueCat "Keep with original App User ID"에 맞춰 **귀속 변경 거부 + 충돌 기록**으로 둔다(계정 병합·자동 이관 금지) — 사용자가 "다르게 원하면 말하라"에 별말 없어 이 방향 확정 (확인됨: ㄱㄱ)
