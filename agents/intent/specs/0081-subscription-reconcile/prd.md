# PRD — 대사·재시도·운영 알림 (서버, #165 Slice 3)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-15
- **이슈:** #165 (TASK-006 ④)
- **관련 태스크**: 인앱결제 IAP+RevenueCat — 서버 세 번째 슬라이스(운영 견고성). 선행: [0079](../0079-subscription-sync-core/prd.md)(Slice 1)·[0080](../0080-revenuecat-webhook-sync/prd.md)(Slice 2). 설계: ADR-12 + Codex(2026-10-15 Slice 3 리뷰).

## 1. 문제 (Problem)
Slice 2로 웹훅→동기화 운영 경로는 열렸지만, **실패 이벤트는 수신함에 `failed`로 남을 뿐 재처리 주체가 없고**(nextRetryAt도 미설정), 웹훅 **누락·역순·공급자 드리프트**를 바로잡을 정기 대사가 없다. 이 슬라이스는 외부 계정 없이 **재시도 실행 + 정기 대사 + 최소 운영 리포팅**을 더한다.

## 2. 목표 (Goals)
- G1. **재시도 잡**(standalone CLI): 수신함의 재처리 대상(received·failed, nextRetryAt 도래, attempts<MAX)을 골라 `processEvent` 재호출. 실패 시 지수 백오프로 nextRetryAt 갱신, MAX 초과는 dead-letter(더 안 뽑힘).
- G2. **대사 잡**(standalone CLI): `BillingCustomer`를 batch로 재조회해 현재 상태 반영 + **드리프트 정리**(공급자 응답에서 사라진 active/grace 구독 → expired 강등). 공급자 실패 고객은 건너뜀(만료 금지).
- G3. **첫 실패에 nextRetryAt 설정**(processEvent 수정) — 웹훅 경로 실패가 재시도 큐에 들어가게.
- G4. **최소 운영 리포팅**: 구조화 로그 + 카운트(retried/succeeded/deadLettered/reconciled/drift). 임계 초과 시 warn.
- 집 운영잡 패턴 준수: dry-run 기본·`--execute`·kill-switch env·batch limit+cap·**setInterval/부트훅/HTTP 금지**(크론/수동만), 위험 서비스는 전용 CLI 모듈에만.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 앱 구독 상품·구매/복원 UI·identify(매핑 생성) → Slice 4.
- N2. 샌드박스 양 플랫폼 출시 검증 → Slice 5.
- N3. 외부 알림 인프라(PagerDuty/Slack 등)·메트릭 대시보드 — 출시 전 범위 밖(로그/카운트까지).
- N4. 스키마 변경 — dead-letter는 기존 필드(status=failed + nextRetryAt=null + attempts≥MAX)로 표현(마이그레이션 없음 목표, Codex 검토로 확정).
- N5. 실제 RevenueCat 계정·키·크론 등록 — 배포/운영.

## 4. 사용자 흐름 (User Flow)
(운영 관점) 크론①(재시도): 수신함 재처리 대상 → processEvent → 성공/백오프/dead-letter. 크론②(대사): 고객별 재조회 → 상태 반영 + 사라진 구독 expired. 권한 판정(`GET /me/access`)은 저장된 구독을 읽어 불변.

## 5. 성공 지표 (Success Metrics)
- 실패 이벤트가 재시도로 processed 되고, MAX 초과는 dead-letter로 멈춤(무한 재시도 없음).
- 공급자에서 사라진 active 구독이 대사로 expired 되되, 공급자 일시 실패로는 절대 만료 안 됨.
- `bash agents/harness/evals/checks.sh` ALL PASS + `scripts/db-e2e.sh`.

### Acceptance
- [x] **원자 claim + lease**(웹훅·재시도 공유) — processed/dead만 종결, lease 토큰 조건부 완료로 성공 역행·중복 완료 방지(Codex 블로커 A) + 단위
- [x] **stored dead-letter**(enum `dead`) + 백오프 min(24h,5m·2^(n-1))+jitter·MAX=8·실패 시 nextRetryAt 예약(processEvent 공통 경로) + 단위
- [x] 재시도 서비스 + CLI(dry-run/execute/kill-switch/limit+cap·커서·회수) — 대상 선별·성공/실패/dead 집계 + 단위
- [x] 대사 서비스 + CLI(dry-run/execute/kill-switch·안정 커서) — 고객 재조회·반영·공급자 실패 skip·소유권/stale 준수(사라진 구독 만료는 **보류**) + 단위
- [x] 운영 리포팅(카운트·backlog·누적 dead·warn 로그) · 전용 CLI 모듈(AppModule 비포함)
- [x] 통합 e2e(실 PG): 실패→재시도 processed·MAX→dead·dry-run 무변경·대사 반영·공급자 실패 유지(5케이스) + 마이그레이션(enum `dead`/`leaseExpiresAt`) 실적용
- [x] `bash agents/harness/evals/checks.sh` ALL PASS + `scripts/db-e2e.sh`

## 6. 제약 (Constraints)
- 서버가 진실·웹훅=재조회 트리거 불변. 대사 쓰기도 **verifiedAt 펜싱·소유권 거부·환경 게이트** 준수.
- 공급자 ok:false(일시 오류/타임아웃)는 **기존 상태 유지**(만료·강등 금지).
- 무인 대량 실행 방지(dry-run 기본·cap·kill-switch). 비밀값 env.

## 7. 애매한 곳·가정 (Open Questions)
- 멱등만으로 불충분 → **이벤트별 원자 claim + lease 토큰 조건부 완료**로 성공 역행·중복 완료 방지(별도 락). 재시도 잡은 선택+호출만 (확인됨: Codex 블로커 A)
- 드리프트 "사라진 구독 expired"는 ok:true 완전스냅샷 미보장 + Subscription에 env/provider/customer 식별자 없어 오만료 위험 → **이 슬라이스 보류**, 스키마 확장·완전스냅샷 보장 후 별도 (확인됨: 사용자 Q1=A)
- dead-letter는 파생 아님 → **저장된 enum `dead`**(MAX 비종속·웹훅 재전송도 종결) (확인됨: Codex 블로커 C)
- 백오프 min(24h, 5m×2^(attempts-1)) + jitter(±20%)·MAX=8 (가정)
- nextRetryAt·attempts·상태는 **processEvent(공통 경로)만** 기록(작성자 단일화), 잡은 선택+호출만 (확인됨: Codex 중대 2)
- claim 수정은 Slice 3에서(Slice 2 PR#201 미건드림) (확인됨: 사용자 Q2)
