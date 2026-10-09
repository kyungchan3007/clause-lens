# PRD — 보관 만료 실삭제 잡 (DB + S3)

- **이슈:** #164
- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-09
- **관련 태스크**: TASK-006 ③
- **의존**: #163(보관 상태 TEMPORARY/SAVED·`documentVisible` default-deny) · **설계 근거**: ADR-12 · ADR-06(보존·삭제)

## 1. 문제 (Problem)
- 현재는 보관 만료 시 410 접근 차단만 — **물리 삭제가 없다**. 무료 7일 경과·구독 만료+유예 경과 문서가 DB·S3에 영구 잔존 → 삭제 정책(ADR-06) 미충족.
- 원본 finalKey는 랜덤 UUID라 DB에서만 알 수 있고, DB는 cascade 삭제되지만 S3는 수동 → 순서를 틀리면 고아 객체 발생.

## 2. 목표 (Goals)
- G1. 삭제 **후보 판정 순수 함수**(무료 7일 만료 / 구독 만료·탈퇴+30일 유예 경과) + 단위.
- G2. **dry-run**(읽기 전용 집계)으로 영향 범위를 먼저 확인.
- G3. **실삭제 잡**(멱등·부분 실패 복구): 조건부 `DELETING` 전환 → S3 객체 삭제 → DB 정리. 격리 데이터로 검증.
- G4. 삭제 범위 명시: 원본·파생(정규화) 이미지·OCR(DB) + tmp 업로드 잔여.

## 3. 목표가 아닌 것 (Non-goals)
- N1. 결제·구독 행 생성(#165) · N2. 저장 전환(#163) · N3. 사용자 수동 삭제 UI · N4. 스케줄러 운영 배포(잡 진입점만, 크론 등록은 후속/운영).

## 4. 사용자 흐름 (운영 흐름)
1. (dry-run) 후보 집계 → 영향 건수·바이트 로그. 변경 없음.
2. (실행) 후보별: 조건부 `DELETING` 전환(재검증) → S3 키 열거·삭제(멱등) → DB 행 삭제(cascade). 부분 실패는 다음 실행에서 복구.
3. 배치 상한·실패 집계. DELETING은 비가역(재구독이 되살리지 않음).

## 5. 성공 지표 (Success Metrics)
- dry-run 집계가 실제 삭제 대상과 일치. 실행 후 대상 DB 행·S3 객체 0건 잔존, 비대상 무영향. 재실행 멱등(이미 없는 객체 성공 처리). `checks.sh` PASS.

## 6. 제약 (Constraints)
- 서버가 진실의 기준. **DB 참조 제거 전 S3 키를 먼저 열거**(랜덤 UUID 복구 불가). DELETING 비가역·유예 완전 경과 후에만 진입.
- 멱등·배치 상한·초기 dry-run·실패 복구. → [context/architecture.md](../../context/architecture.md)

## 7. 미해결 질문 (Open Questions)
- Q1. DELETING을 Document 상태로 둘지 vs 별도 삭제 작업 레코드 — SDD(적대적 리뷰) 확정.
- Q2. 잡 실행 주체(worker setInterval vs API 커맨드 vs 수동 스크립트) — SDD 확정.
- Q3. S3 삭제 단건 vs prefix 열거 — tmp/finalKey/정규화 키 수집 방식 SDD 확정.

## Acceptance
- [x] 삭제 후보 판정 순수 함수(`isTemporaryHardDeletable`·`deletionReason`, 안전지연 LAG) + 단위(retention-ops 9건)
- [x] dry-run(읽기 전용 집계, 기본 모드)으로 영향 확인 — `RetentionSweepService.dryRun` + 스크립트
- [x] 삭제 잡(멱등·부분 실패 복구: S3 전 키 성공 후에만 행 삭제, DELETING 잔류 복구) — 서비스 단위 + db 통합(격리 데이터)
- [x] `bash agents/harness/evals/checks.sh` **ALL PASS**
- 범위: **무료(TEMPORARY)만**. SAVED(구독 만료) 삭제는 #165로 연기(lapsedAt·트랜잭션 내 구독 재확인) — 적대적 리뷰 C1, 사용자 확정.
- 가드: dry-run 기본·`--execute` 명시·중단 상한·DeletionAudit·kill-switch(`RETENTION_SWEEP_DISABLED`)·setInterval 금지.
- 참고: S3 삭제 포함 end-to-end는 실 Postgres+MinIO 필요(gate 밖) — 백엔드 기동 시 `migrate deploy` 후 `recall.integration.mjs` + dry-run 실행으로 검증.
