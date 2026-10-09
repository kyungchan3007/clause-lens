# PRD — 분석 결과 장기 보관 전환(저장하기)

- **이슈:** #163
- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-09
- **관련 태스크**: TASK-006 ②
- **의존**: #162(구독 상태·권한 모델, `canSaveDocuments`) · **설계 근거**: ADR-12 · ADR-06(보존·삭제)

## 1. 문제 (Problem)
- 무료 분석 결과는 완료+7일(`retainUntil`) 뒤 접근이 차단(410)되고 목록에서 사라진다.
- 구독 사용자가 결과를 **계정에 장기 보관**(저장하기)할 방법이 없다. 서버에 보관 의사를 영속할 상태·엔드포인트가 전무하다.

## 2. 목표 (Goals)
- G1. `Document`에 보관 상태를 더해 **TEMPORARY(무료 7일)→SAVED(장기 보관)** 전환을 영속한다.
- G2. 상세(410)·목록·저장이 **같은 보관 판정(순수 함수)** 을 공유해 일관되게 노출/차단한다.
- G3. **멱등 저장 API** — 소유권·완료·미만료·구독 보관 권한을 서버가 검증(클라 상태만으로 완료 처리 금지).
- G4. 결과 화면 "저장하기" → 성공 시 목록 재조회로 반영.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 결제·구독 행 생성(#165) · N2. 보관 만료 실삭제·DELETING 전환 실행(#164) · N3. 저장 해제(unsave)/재분석.

## 4. 사용자 흐름 (User Flow)
1. 결과 확인 → "저장하기" 선택(미로그인 시 로그인 안내).
2. 서버가 소유권·완료·미만료·구독 보관 권한 검증.
3. 권한 없으면 구독 안내 반환, 있으면 원자적 상태 전환(TEMPORARY→SAVED).
4. 앱은 서버 문서 목록 재조회. 저장 문서는 7일이 지나도 목록·재열람 유지.

## 5. 성공 지표 (Success Metrics)
- 미구독 저장 요청 서버 거부, 구독 사용자 저장 후 앱 재실행·7일 경과에도 재열람. 중복 저장으로 복제·상태 꼬임 없음. `checks.sh` PASS.

## 6. 제약 (Constraints)
- 서버가 진실의 기준. 보관 유효 기한은 **상태로 계산**(먼 미래 날짜 반복 기록 안 함, `retainUntil`은 유지).
- 멱등·원자적 전환. 운영 노출은 기능 플래그로 제한. → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. SAVED 게이트에서 구독 재확인 여부(유예 30일은 #164 권한) — SDD 확정.
- Q2. 보관 상태 표현(enum vs 파생) — SDD 확정.

## Acceptance
- [x] 보관 상태(TEMPORARY/SAVED)+savedAt 모델 + 보관 판정 순수 함수(`documentVisible`·`canTransitionToSaved`) + 단위(retention-visibility 15건)
- [x] 저장 API `POST /me/documents/:id/save`(멱등·소유권·완료·미만료·구독 권한 결정표) + 서비스 단위 8건
- [x] 목록/상세가 `documentVisible` 공유 — SAVED는 7일 경과에도 유지, TEMPORARY는 기존대로 만료(recall 게이트 + 목록 쿼리)
- [x] 유예 중 기존 저장 재열람 가능(게이트 통과)·신규 저장 불가(만료 TEMPORARY 저장 410)
- [x] 결과 화면 저장하기(`onSave` + 저장 버튼, 기능 플래그 OFF) + 성공 시 목록 재조회(`useSaveDocument`→refresh) + 단위 15건
- [x] `bash agents/harness/evals/checks.sh` **ALL PASS**
- 참고: DB 통합 테스트(recall.integration.mjs의 SAVED parity)는 실 Postgres 필요·gate 밖 → 백엔드 기동 시 `migrate deploy`와 함께 검증(Docker 데몬 off로 이번 미실행).
