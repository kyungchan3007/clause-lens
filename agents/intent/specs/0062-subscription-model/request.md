<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #162

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/162
- 캡처: 2026-10-02

---
## 요약
- TASK-006 ① — 구독 상태·권한의 서버 계약
- 별도 `Subscription` 엔티티 + 보관/분석 권한 조회
- 설계: ADR-12 (Codex 2026-10-02)

## 설계
- `Subscription`
  - 상태: active / grace / expired
  - `currentPeriodEnd` · `autoRenew` · 플랫폼 · 상품 · 외부 구독ID · `verifiedAt`
  - 사용자별 복수 이력 허용, 현재 유효 구독에서 권한 계산
- 역할 분리
  - `Entitlement` = 무료 분석 잔액 (기존)
  - `Subscription` = 보관 권한 + 분석 월 쿼터 근거
- 권한 조회 API
  - 보관 권한 여부
  - 분석 월 쿼터 잔여
- 순수 함수: 유효 구독 판정 · 월 쿼터 계산 (시계 주입, 테스트 용이)

## 범위 밖
- 실제 결제·영수증 검증 → ④
- 저장 전환 → ②
- 실삭제 → ③

## 완료 조건
- [ ] `Subscription` Prisma 모델 + 마이그레이션
- [ ] 유효 구독·월 쿼터 판정 순수 함수 + 단위 테스트
- [ ] 권한 조회(보관 가능·월 쿼터 잔여) API + 계약
- [ ] 분석 접수 근거(FREE / SUBSCRIPTION) 원장 기록 계약
- [ ] `checks.sh` PASS
