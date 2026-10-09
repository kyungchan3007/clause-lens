# 0069 — 보관 만료 실삭제 잡 (TRACE)

- **이슈:** #164 · **의존:** #163(retentionState) · **브랜치:** chore/164-retention-hard-delete (feat/163 위 스택)

## 2026-10-09

### 착수
- TASK-006 ③ 실삭제. #163의 retentionState 스키마에 의존 → #163 미머지라 `feat/163-save-retain` 위 **스택 브랜치**.
- 브랜치 접두사 교정: 새 삭제 잡(chore/storage)이라 `fix/164`→`chore/164`.
- 원문 고정: `pnpm request 164` → request.md(불변, 562자).

### 설계 토론 (적대적 리뷰, 2026-10-09)
- **데이터 영구 삭제**라 Codex 대신 서브에이전트 적대적 리뷰(데이터 손실·순서·크래시·멱등·동시성·후보 판정 집중). Codex exec는 지난 태스크에서 응답 미출력 이력 → 서브에이전트.
- 검토 중 제안: DELETING을 RetentionState enum에 추가(documentVisible default-deny로 자동 숨김·크래시 복구용 영속) / 후보 판정 순수함수(TEMPORARY=retainUntil≤now, SAVED=!canSaveDocuments && graceDeadline≤now) / dry-run→조건부 DELETING CAS→DB에서 키 열거→S3 멱등 삭제→행 삭제 / API-side 서비스 + standalone 스크립트(크론 미등록) / 배치 상한·실패 큐.
- Q1~Q7(grace deadline 정확성·크래시 지점별 고아·free 즉시삭제 안전지연·enum 영향·S3 키 열거·러너 선택·최악 실패) 답변 반영 후 SDD 확정 예정.

### 적대적 리뷰 결론 반영 (서브에이전트, 코드 대조)
- **범위 축소(사용자 확정): 무료(TEMPORARY)만 실삭제, SAVED는 #165로.** 사유: SAVED 문서는 #165(구독 생성) 전엔 부재(미검증)·유예 앵커 lapsedAt 없음·구독 스냅샷→CAS 재구독 TOCTOU로 결제 중 문서 삭제 위험. #164는 구독 로직 미접촉.
- C3: 전 S3 키 삭제 확인(NotFound만 성공·transient는 중단) 후에만 행 삭제 — 중간 실패는 DELETING 잔류 복구.
- C4: 목록 쿼리에 `retentionState<>'DELETING'` 명시(documentVisible 미경유 경로 — SAVED→DELETING·retainUntil 미래 엣지).
- C5: 안전 지연 `retainUntil + 3일 <= now`(410 차단과 분리·skew·오확정·지원 복구 여유).
- C6: dry-run 기본·`--execute` 명시·standalone 스크립트. **setInterval·부트훅·HTTP 금지.**
- C7: 중단 상한(초과 시 run 전체 abort+경보)·**DeletionAudit**(삭제 전 기록)·kill-switch env.
- KEEP: DELETING 영속 enum(복구·documentVisible 숨김)·DB 전 S3 열거·멱등·finalKey DB·normalizedImageKey 헬퍼·API-side(worker delete 없음)·CAS 0행 skip.
- 알려진 후속 TODO: multi-revision(TASK-007) 구키 누수·중단 draft/failed tmp 누수(retainUntil null이라 비대상).

### 구현 완료 (2026-10-09)
- **스키마**: RetentionState에 DELETING + `DeletionAudit`(append-only, FK 없음) + 마이그레이션 `20261009010000_add_retention_delete`(ALTER TYPE ADD VALUE + CREATE TABLE). prisma validate PASS.
- **순수/DB**(retention-ops): `isTemporaryHardDeletable`·`deletionReason`(LAG 3일) + `countHardDeleteCandidates`·`findHardDeleteCandidates`·`transitionToDeleting`(CAS make_interval)·`loadDocumentKeysData`·`recordDeletionAudit`·`deleteDocumentRow`. 목록 쿼리에 `retentionState<>'DELETING'`.
- **API retention 모듈**: `documentDeletionKeys`(finalKey null 스킵·normalizedImageKey·tmp·dedupe) + `RetentionSweepService`(dryRun/execute: CAS→키열거→감사→S3 전키삭제→행삭제; 중단상한·NotFound외 실패시 행삭제 보류) + 모듈(AppModule 등록) + standalone 스크립트(dry-run 기본·--execute·kill-switch).
- **단위**: retention-ops 9·keys 4·sweep 서비스 5 — api jest 통과. (삭제 전 감사·S3 실패 시 행삭제 보류·CAS skip·중단상한 검증.)
- **통합(gate 밖)**: recall.integration.mjs에 후보/안전지연/DELETING CAS 멱등/목록제외/감사/행삭제 섹션. Docker off로 live 미실행 → 백엔드 기동 시 migrate deploy와 함께.
- **게이트**: `bash agents/harness/evals/checks.sh` **✅ ALL PASS**.

### 남음
- 커밋(3섹션)·푸시·PR(#164, feat/163 위 스택). 후속 TODO: multi-revision(TASK-007) 구키 누수·중단 draft/failed tmp 누수·SAVED 삭제(#165 lapsedAt)·크론 등록(운영).
