# TRACE — 대사·재시도·운영 알림 (서버, #165 Slice 3)

- 2026-10-15 착수. #165 5슬라이스 중 Slice 3. 선행 Slice 2(0080) PR#201 미머지 → 브랜치 `feat/165-subscription-reconcile`를 **Slice 2 브랜치 위에 스택**(base=feat/165-revenuecat-webhook). Slice 2 머지 시 PR을 develop으로 재타겟.
- 집 운영잡 패턴(retention-sweep #164) 준수: standalone CLI + 전용 CLI 모듈(AppModule 비포함) + kill-switch env + dry-run 기본/--execute + batch limit+cap. **setInterval·부트훅·HTTP 금지**(무인 자동실행 방지).
- 설계 규칙(codex-design-discussion-first): Slice 3 설계안 Codex 적대적 리뷰 의뢰(background, scratchpad/codex-slice3-design.md). 논점 A~F: 재시도↔웹훅 동시성/락, 드리프트 expired↔펜싱·부분응답, dead-letter 무스키마 표현, 대사 범위/비용, nextRetryAt 설정 위치, CLI 1 vs 2. **리뷰 결과 반영 후 sdd 확정·구현.**

- **Codex 리뷰(세션 bal47jjra) 반영**: 블로커 4.
  - [A] processed 검사만으론 동시실행 못 막음 — 웹훅·잡이 같은 failed를 읽으면 성공이 failed로 역행 가능 → **원자 claim + lease 토큰 조건부 완료**(성공 역행·중복 완료 불가, 크래시 회수).
  - [B] 대사 "사라진 구독 expired"는 ok:true 완전스냅샷 미보장 + Subscription에 env/provider/customer 식별자 없어 오만료 위험 → **보류**(사용자 Q1=A). 스키마 확장·완전스냅샷 보장 후 별도 슬라이스.
  - [C] dead-letter가 MAX 종속(올리면 부활·웹훅 재전송 우회) → **enum `dead` 저장 상태**.
  - [중대] attempts/schedule 작성자 단일화(processEvent만)·실패분류·백오프 min(24h,5m·2^(n-1))+jitter·대사 커서·dry-run 무변경·양 잡 운영가드.
  - 사용자 결정: Q1=A(만료 보류), Q2=claim 수정은 Slice 3(Slice 2 PR 미건드림). 원 지적 전문: scratchpad/codex-slice3-out.txt. 반영본=sdd.md.

- **구현 완료(2026-10-15)**:
  - 스키마: enum `dead` + `SubscriptionEvent.leaseExpiresAt` + 인덱스. 수기 마이그레이션 `20261015010000_add_subscription_event_lease_dead`(ALTER TYPE ADD VALUE IF NOT EXISTS·ADD COLUMN·CREATE INDEX) — PG17 실적용 성공.
  - `subscription-sync.service` 재구성: 원자 claim(updateMany OR received/failed/만료processing, attempts++)·lease 토큰 조건부 완료(성공 역행·중복 완료 방지, LeaseLostError 롤백)·`completeFailure`(백오프 or dead)·`completeTerminalSkip`·`applySnapshots` 추출·`reconcileCustomer`·`computeNextRetry`/`isTerminalStatus` export.
  - `subscription-retry.service`(+CLI `scripts/subscription-retry.ts`): 후보 선별(failed 기한도래·received·만료 processing 회수)·선택+호출만·성공/실패/dead/skip·backlog·누적 dead 집계·dry-run/execute/kill-switch/cap.
  - `subscription-reconcile.service`(+CLI `scripts/subscription-reconcile.ts`): BillingCustomer 안정 커서 순회·reconcileCustomer·공급자 실패 skip·사라진 구독 만료 보류·dry-run/execute/kill-switch.
  - `subscription-jobs-cli.module`(AppModule 비포함, SubscriptionsModule 재사용). `.env.example` SUBSCRIPTION_JOBS_DISABLED.
- **테스트**: 단위 — 서비스(claim·dead·재진입·reconcile 18)·재시도(6)·대사(5)·어댑터/가드(19) = api 재사용 포함. 서브스크립션 단위 47 통과. e2e — 잡(재시도→processed·MAX→dead·dry-run 무변경·대사 반영·공급자실패 유지 5) + 기존 11 = 16 통과.
- **게이트**: `checks.sh` ALL PASS + `scripts/db-e2e.sh` 통과.
- 범위 밖(보류): 드리프트 "사라진 구독 expired"(스키마+완전스냅샷 필요) · identify 매핑 생성(Slice 4) · 샌드박스 출시검증(Slice 5) · 능동 알림 인프라.

- **PR#201 자동리뷰 P1 조치(2026-10-17, Slice 3가 #201에 머지됨)**:
  - 대사 execute 루프의 `reconcileCustomer` 호출을 try/catch로 격리 — 한 고객 예외(DB 오류 등)가 배치 전체를 중단시키던 문제 수정. 예외는 `errored` 카운트+warn로 집계하고 다음 고객 계속. 단위 테스트(예외 뒤 고객도 처리) 추가.
