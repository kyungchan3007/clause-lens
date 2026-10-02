# 0062 — 구독 상태·권한 모델 (Subscription) (PRD)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-02
- **이슈:** #162

## 1. 문제 (Problem)
TASK-006(구독·문서 저장)의 **첫 세로 슬라이스**. 현재 백엔드엔 구독 개념이 전혀 없다.
- `User`에 plan/subscription 필드 없음. `Entitlement`는 무료 3회(평생)만.
- 장기 보관·분석 월 쿼터 같은 **구독 권한을 판정·조회할 서버 계약이 없다.**
- 설계는 ADR-12(Codex 2026-10-02)에서 확정: 결제=IAP+RevenueCat · 혜택=보관 무제한 + 분석 월 쿼터 · 별도 `Subscription` 엔티티.

## 2. 목표 (Goals)
- G1. `Subscription` 엔티티 — 구독 상태(active/grace/expired)·기간·플랫폼·외부 구독ID를 서버에 영속.
- G2. **순수 함수**로 유효 구독·보관 권한·분석 월 쿼터를 판정(시계 주입, 테스트 용이).
- G3. 분석 접수 시 **승인 근거(FREE | SUBSCRIPTION)를 원장(EntitlementCharge)에 기록** — 구독자는 월 쿼터에서, 아니면 무료에서 선점.
- G4. 권한 조회 — 보관 가능 여부 + 분석 월 쿼터 잔여를 서버가 돌려준다.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 실제 결제·영수증 검증·플랫폼 알림 → #165(④). 이 슬라이스는 `Subscription` 행을 **쓰지 않는다**(모델·계약만, 행은 ④가 생성·테스트는 시드).
- N2. 저장(보관) 전환 UI·API → #163(②).
- N3. 보관 만료 실삭제 → #164(③).

## 4. 사용자 흐름 (User Flow)
- (서버 관점) 분석 접수 → 유효 구독이면 월 쿼터에서 1회 선점(근거=SUBSCRIPTION), 없으면 무료에서(근거=FREE), 둘 다 없으면 거부(quota).
- 앱이 권한 조회 → "보관 가능?" + "이번 달 분석 남은 횟수"를 안다.

## 5. 성공 지표 (Success Metrics)
- 순수 함수 단위 테스트: 유효 구독 판정(active/grace/expired·기간 경계) · 월 쿼터 잔여(월 경계 리셋) · 접수 근거 결정(구독>무료 우선).
- reserve/settle이 근거별로 올바른 카운터만 변경(무료·구독 혼동 없음).
- `bash agents/harness/evals/checks.sh` ALL PASS.

## 6. 제약 (Constraints)
- 백엔드(api·worker·db·contracts)만. 앱 UI 변경 없음(권한 조회 계약만).
- 분석 월 쿼터 기본값 **50**(상수·추후 config). 보관은 구독 유지 중 무제한(개수 한도 없음).
- 접수 당시 근거 고정 — 실행 중 구독 만료돼도 근거를 무료로 바꾸지 않음(ADR-12).
- 기존 무료 흐름(reserve/settle)·멱등·동시성 보장 유지.

## 7. 미해결 질문 (Open Questions)
- Q1. 월 쿼터 윈도우 = 캘린더월(리셋) vs 구독 기간 기준. → sdd에서 확정.

### Acceptance
- [x] `Subscription` Prisma 모델 + 마이그레이션 (20261002000000_add_subscription)
- [x] `EntitlementCharge.source`(FREE|SUBSCRIPTION) 추가 + 마이그레이션
- [x] 유효 구독·보관 권한·월 쿼터 판정 순수 함수 + 단위 테스트 (subscription-ops)
- [x] 분석 접수 근거 기록(reserveAnalysis: 구독>무료 우선, source) + settleAnalysis 근거별 정산 + 단위
- [x] 권한 조회(보관 가능·월 쿼터 잔여) API `GET /me/access` + 계약 `accessResponseSchema`
- [x] `bash agents/harness/evals/checks.sh` PASS + 단위(api 28건)
