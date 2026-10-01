# 0030 — 과정 기록 (trace)

## 판단
- **착수 전 Codex 설계 토론**(사용자 워크플로우): 구현 전 설계를 Codex와 교차검증(codex-recall-r1.md). 핵심 반영:
  - **핵심 재프레이밍**: "목록 추가"가 아니라 **"24h 세션을 7일간 다시 열 수 있는 문서로 전환"**. 조회·이미지·재분석 결과 선택이 **같은 보관 판정**을 공유해야 함.
  - **[블로커] 세션 TTL(24h) vs 재열람(7일) 분리**: 코드 확인 결과 `findOwnedSession`은 expiresAt 미필터 → 24h가 재열람을 막지 않음(이미 분리돼 있음). 대신 **보관 게이트가 아예 없음** → `retainUntil` 추가해 상세·스트림을 게이트. retainUntil null(진행중)=세션 접근 통과 / 설정+과거=410 으로 **진행중/완료 접근을 자연 분리**.
  - **[중대] completedAt/retainUntil 영속 + 확정 시 1회 설정**: 조회마다 createdAt+7일 계산 금지(분석 소요 포함·소급 위험). terminal tx(settle 옆)에서 `completedAt IS NULL` 가드로 1회. **중복 완료 연장 금지**. 재분석 연장은 별도 정책(TASK-007). 기존 done|partial 백필.
  - **[중대] 목록·상세·집계가 같은 공개 결과(최신 terminal 성공) 기준**: "문서당 최신 job"이 진행중/실패면 이전 성공을 못 염 → 선택 규칙 명시. 현재 문서당 1 job 보장(활성 유니크+FOR UPDATE)이라 모호성 없음. revision 중복 집계 금지(= pa.revision 귀속 조항만).
  - **[블로커] 목록 숨김 ≠ 삭제**: retainUntil>now 필터는 노출 종료, 상세·발급에도 적용하면 재열람 종료. **어느 쪽도 실삭제 아님** → 사용자 "7일 뒤 삭제" 공개는 #74에 의존. 이번은 접근 차단까지, #74와 삭제 대상(원본·파생·OCR·조항) 합의.
  - **[중대] partial 표시**: done|partial 포함하되 totalPageCount/analyzedPageCount 구분(“일부 분석 완료”). "위험 N건" 기준(high/med/low)을 계약·화면에 고정.
  - **[중대] 커서·권한**: 완료순(completedAt) + documentId tiebreak 안정 커서. 매 요청 인증·보관·공개결과 재적용(앱 generation은 서버검사 대체 아님). OCR·조항·서명URL 로그 제외.
  - **[중대] N+1 금지**: 문서 1페이지 선정 후 공개 결과만 일괄 집계. 집계 캐시는 근거 생긴 뒤.
  - **[중대] 최근≠저장**: Document·공개결과·보관판정은 공유하되, 최근=조회방식 / 저장=사용자행동·정책상태. 구독(TASK-006) 확장 여지(무료보관 vs 장기저장 상태)만 남김. retainUntil=null로 장기/미설정/오류를 뭉뚱그리지 말 것.
  - 현행 유지: `GET /me/documents`·retainUntil 영속·done|partial 중심·임시 문서명·ResultScreen 재사용·entitlement 계약/인증격리 패턴(단 store는 복제 말고 목록 전용).

## 사용자 범위 결정 (AskUserQuestion)
- **재열람 범위**: "조항 재열람 먼저, 이미지 하이라이트는 바로 다음" → 이번 이슈는 조항 목록 재열람까지, 이미지 하이라이트 재열람은 별도 후속 이슈.
- **삭제(#74)**: "지금은 접근 차단(재열람 종료)만, 실삭제는 #74로 바로 다음" → retainUntil 게이트로 접근만 차단, 연쇄 실삭제는 #74.
- 선행순서(사용자): 이 "구독 전 기능"(재열람 토대) 먼저 → 이미지 하이라이트 재열람 → #74 삭제 → TASK-006 구독·결제·저장.

## 막힘 / 되돌림
- **재열람이 이미 세션 TTL과 분리돼 있었음**: `findOwnedSession`이 expiresAt 미필터라 24h가 재열람을 막지 않음(Codex 블로커 #1이 코드상 이미 충족). 남은 구멍은 "보관 종료가 전혀 없음"이라 `retainUntil` 게이트(410)만 추가하면 됨 — 설계보다 작업이 줄었다.
- **진행중/완료 접근을 retainUntil null 여부로 분리**: 진행중(terminal 전, retainUntil=null)은 통과시켜 폴링을 막지 않고, terminal 후엔 retainUntil로 차단. `isRetentionActive(null)=true`로 한 함수에 표현.
- **집계는 raw SQL 조인으로**: 위험 집계를 공개 결과의 (pageId, pa.revision)에 정확히 묶기 위해 `PageAnalysis ⋈ Clause` raw 조인(groupBy로는 revision 매칭 불가). 실 Postgres 통합 테스트로 revision 중복/가려짐 없음 실측.
- **재열람 UI 합성은 app 레이어에**: documents 기능이 result UI를 직접 import하면 "기능 간 직접 참조 금지" 위반 → `useDocumentReview`(데이터만, documents) + ResultScreen 합성은 `app/result.tsx`(상위 레이어). 메모리 스냅샷(이미지 포함) 경로는 그대로 두고, 그 외는 서버 재조회(조항만) 경로로 분기.
- **홈 섹션 주입**: capture가 documents를 모르도록 `CaptureScreen`/`EmptyState`에 `extra`(ReactNode) 슬롯만 추가하고, `RecentAnalysisSection`은 app 레이어(index.tsx)가 주입.
- **이미지 하이라이트 재열람은 범위 밖**: 재열람 결과는 `imageByPageId={}`로 조항만. ResultScreen이 이미지 없을 때 목록만 표시(우아한 저하, 기존 지원).
- **되돌림 없음** — Codex 토론 설계 + 사용자 범위대로 진행. 실삭제(#74)·이미지 하이라이트 재열람·시뮬레이터 실측·백엔드 seeding e2e는 후속.
