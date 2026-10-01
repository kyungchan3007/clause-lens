# 0030 — 분석 기록 재열람: 문서목록 API + 7일 보관(접근 차단) — PRD

> **이슈:** #96 · **관련 태스크**: #96 (task, TASK-008) · **상태**: in-progress · **유형**: 기능 (서버+앱 · 재열람/보관)

## 1. 문제
분석을 마쳐도 앱을 나가면 결과를 **다시 볼 방법이 없다**. 정책(02 · ADR-06)은 무료 사용자도 분석 완료 결과를 **7일간 재열람**할 수 있어야 한다고 정하는데, "내 문서 목록" API도, 홈/목록 화면도 없다. 또한 업로드 세션 TTL(24h)과 결과 보관(7일)이 코드상 구분돼 있지 않아, 목록엔 보이는데 상세는 안 열리는 모순이 생길 수 있다. "서버가 진실의 기준" — 앱은 서버가 준 보관 기한·집계를 표시만 한다. 착수 전 Codex 설계 토론 반영.

## 2. 목표
- G1. **접근 모델 분리**: 업로드·분석 접수=세션 TTL(24h) / 결과·재열람=보관 정책(`retainUntil`) / 소유권=공통. 결과 재열람은 세션 만료와 무관하게 `retainUntil>now`+소유권으로만 판정.
- G2. **보관 모델 영속화**: `Document.completedAt`·`retainUntil` 신설. terminal(done|partial) 확정과 **같은 tx에서 1회** 설정(= completedAt + 7일). 중복 완료 이벤트는 기한을 연장하지 않음. 기존 done|partial 백필.
- G3. **공개 결과 선택 규칙 통일**: 문서별 "지금 읽을 수 있는 결과" = **최신 terminal 성공 job**. 목록 집계·상세·(후속)하이라이트가 모두 같은 job/revision을 가리킨다(진행중/실패 job에 가려지지 않음, revision 중복 집계 없음).
- G4. **목록 API** `GET /me/documents`(인증): 소유자·공개결과(done|partial)·`retainUntil>now`만, **완료순** 커서 페이지네이션. 항목 {documentId, completedAt, totalPageCount, analyzedPageCount, risk{high,medium,low}, retainUntil, label}. 일괄 집계(N+1 금지)·페이지 상한.
- G5. **접근 차단(= 재열람 종료)**: 목록·결과 상세 재열람을 `retainUntil>now`+소유권으로 게이트. 기한 지난 건은 재열람 불가(명확한 상태 코드). *실삭제*는 #74(후속).
- G6. **앱**: 홈 '최근 분석' 섹션 + 최근 분석 목록 화면 — 서버 값 표시, "N일 후 삭제"(<1일 "오늘 만료"), 재열람(조항)은 ResultScreen 재사용, 계정 격리·페이지네이션.

## 3. 목표가 아닌 것 (Non-goals)
- N1. **이미지 하이라이트 재열람**(이미지 7일+ 수명·서명 URL 재발급·메모리 스냅샷 없이 복원) — **바로 다음 이슈**. 이번 재열람은 **조항 목록만**.
- N2. **실삭제 정리 잡**(retainUntil 경과 시 원본·파생·OCR·조항 연쇄 삭제, 접근 종료↔삭제 지연 정의) — **#74, 바로 다음**. 사용자에게 "7일 뒤 삭제"를 **공개하기 전 필수**. 이번엔 접근 차단까지만.
- N3. **구독 저장**(무료 보관 vs 장기 저장 상태·저장 시각·해지 전환 규칙·만료 후 유예) — TASK-006. 단, 상태 확장 여지만 남긴다(§SDD).
- N4. 집계 캐시 테이블 — 실제 성능 근거 전 도입 금지. 매 요청 일괄 집계.
- N5. 실패(failed)·진행중 job을 목록에 노출 — 이 화면은 "재열람 가능한 최근 분석"이지 모든 시도 이력이 아님.

## 4. 제약 (Constraints)
- "서버가 진실의 기준": 앱은 `retainUntil`·집계를 표시만, 임의 계산·선제 차단 금지.
- 기존 패턴: NestJS 모듈 + Prisma(raw 원자 연산), zod 계약(`packages/contracts`), 앱은 feature 폴더 + fetch+Bearer + zustand. base=develop.
- 보안/로그: OCR 본문·조항·서명 URL·토큰·개인정보 로그 금지(guardrail). 매 요청 인증·소유권·보관 재검사(앱 generation 격리는 서버 검사 대체 아님).
- 완료 전 `bash agents/harness/evals/checks.sh` PASS.

## Acceptance
- [x] `GET /me/documents`가 소유자·done|partial·`retainUntil>now` 문서만, **완료순** 커서 페이지네이션으로 반환한다(동률은 documentId로 안정). (`DocumentsListController`·`listRecentDocuments` · 단위: mapper 커서 왕복·service 페이지네이션 · db 통합: 필터·정렬·커서 중복없음)
- [x] 각 항목이 risk{high,medium,low} 일괄 집계·totalPageCount·analyzedPageCount·retainUntil·label을 포함하고, 집계는 **공개 결과(최신 terminal) 조항만** 대상으로 한다(revision 중복·가려짐 없음). (db 통합 `recall.integration.mjs`: done=high2/med1, partial=analyzed<total, 중복 revision 없음 실측)
- [x] `completedAt`·`retainUntil`이 terminal 확정과 **같은 tx에서 1회** 설정되고, 중복 완료 이벤트가 기한을 연장하지 않는다. 기존 done|partial 문서가 백필된다. (`reaggregateAndBump` 조건부 UPDATE · db 통합: 7일 설정·중복 완료 무연장 실측 · 마이그레이션 백필 SQL 적용 확인)
- [x] 결과 상세 재열람이 세션 TTL(24h)이 아니라 `retainUntil>now`+소유권으로 게이트된다. 기한 지난 건은 재열람이 차단된다(타 사용자는 접근 불가). (`getAnalysis` 410 게이트 · 단위: 미래=통과·과거=410·null(진행중)=통과·비소유=404)
- [x] 앱: 홈 '최근 분석' 섹션 + 최근 목록 화면이 서버 값을 표시하고, "N일 후 삭제"(<1일 "오늘 만료")를 서버 retainUntil로 계산하며, 항목 선택 시 ResultScreen으로 **조항 재열람**이 동작한다. 계정 전환 시 이전 목록이 노출되지 않는다. (`RecentAnalysisSection`·`RecentListScreen`·`useDocumentReview`·result.tsx 재열람 경로 · 단위: store 계정격리·loadMore·removeDocument·배지 경계 · **시뮬레이터 실측은 후속**)
- [x] 단위 + e2e 시나리오(목록 필터·커서·집계·보관 경계 24h/7일·소유권·계정 격리) 통과, 게이트 PASS. (단위 api+mobile 신규·db 통합 PASS · e2e `recent.yaml`(S22) 섹션 자동 · **목록 내용·410·계정 전환은 백엔드 seeding 필요 → 반자동/실측 후속** · `checks.sh` ALL PASS)
