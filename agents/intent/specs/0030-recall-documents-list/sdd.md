# 0030 — 분석 기록 재열람: 문서목록 API + 7일 보관(접근 차단) — SDD

> **관련 PRD**: prd.md · **이슈:** #96

## 1. 접근 (Approach)

### 1-1. 보관 모델 (DB · packages/db)
- **스키마**: `Document`에 `completedAt DateTime?`·`retainUntil DateTime?`(둘 다 nullable, Timestamptz). 기존 `expiresAt`(세션 TTL 24h)는 **그대로** — 업로드·접수 정리 기준으로만 쓰고 재열람 판정엔 안 씀.
- **인덱스**: `@@index([userId, retainUntil, completedAt])` — 목록 쿼리(소유자 + retainUntil>now + completedAt 정렬)용.
- **확정 시점**: `analysis-ops.ts`의 `reaggregateAndBump` **allTerminal 분기**(settleFreeAnalysis 바로 다음, 같은 tx). terminal(done|partial|failed) 전이 시 **completedAt이 아직 null인 문서에 한해** `completedAt=now`, `retainUntil=now + RETENTION_DAYS(7)`를 조건부 UPDATE(`WHERE id=? AND completedAt IS NULL`)로 1회 설정.
  - **중복 완료 연장 금지**: job terminal은 이미 멱등 no-op이고, 추가로 `completedAt IS NULL` 가드로 재설정·연장 불가.
  - **failed도 설정?** → failed는 목록·재열람 대상이 아님. completedAt은 "terminal 도달"로 통일해 두되, 목록/게이트 필터가 `status IN (done,partial)`로 거른다. (retainUntil은 모든 terminal에 설정 — 재열람 게이트는 status로 분리.) *실패 문서 재열람은 비목표(N5).* 설정 자체는 done|partial만 해도 무방하나, 접근 게이트를 status로 판정하므로 **done|partial에만** 설정(failed는 null 유지)해 의미를 명확히 한다.
- **백필**: 마이그레이션 SQL에서 기존 `status IN ('done','partial')` 문서의 `completedAt`을 `COALESCE(최신 성공 job.updatedAt, createdAt)`, `retainUntil = completedAt + interval '7 days'`로 채운다(이미 지난 건은 지난 값으로 — 접근 차단과 일관).

### 1-2. 접근 차단(재열람 종료) (api)
- **공개 결과 재열람 게이트**: 결과 상세는 앱이 `GET /documents/:id/analysis`(=`getStatus`→`getAnalysis`)로 읽는다. 여기 **보관 게이트**를 추가:
  - 소유권(`findOwnedSession`)은 유지.
  - 문서 `retainUntil`이 **설정됐고(≠null) 과거**면 → `GoneException(410)`("보관 기간이 지나 다시 볼 수 없어요"). retainUntil이 null(아직 미완료·진행중)이면 게이트 **통과**(진행중 폴링을 막지 않음 — 세션 접근).
  - 즉 **진행중=세션 접근 / terminal=보관 접근**이 retainUntil의 null 여부로 자연 분리된다. 24h expiresAt은 재열람에 관여 안 함(이미 findOwnedSession이 expiresAt 미필터임을 확인).
- SSE 스트림(`getStatus`)도 같은 게이트를 타므로 만료 후 재연결은 410으로 종료.

### 1-3. 목록 API `GET /me/documents` (api)
- **라우트**: 신규 `DocumentsListController`(`@Controller("me")` + `@Get("documents")`, `JwtAuthGuard`) — entitlement의 `/me` 패턴 재사용(별도 컨트롤러, 같은 prefix 허용).
- **쿼리 파라미터**: `cursor?`(opaque base64), `limit?`(기본 20, 상한 50).
- **서비스**: `DocumentsService.listRecentDocuments(userId, {cursor, limit})` → repo 일괄 조회:
  1. 문서 1페이지 선정: `Document where userId=? AND status IN ('done','partial') AND retainUntil > now ORDER BY completedAt DESC, id DESC`, 커서 이후 limit+1(다음 페이지 판정).
  2. 선정된 documentId들에 대해 **일괄 집계**(N+1 금지):
     - `totalPageCount`: 문서별 Page count(groupBy documentId).
     - 공개 결과 job = 문서별 최신 job(현재 문서당 1 job; 재분석=TASK-007). analyzedPageCount = 그 job의 PageAnalysis `status='done'` count.
     - risk 집계: 그 job의 done 페이지들의 `(pageId, pa.revision)`에 귀속된 `Clause`를 riskLevel별 count(groupBy). **공개 결과 조항만** 대상(revision 일치로 과거/다른 revision 제외).
  3. 라벨: `"계약서 · {totalPageCount}장"`(임시 문서명 — 별도 title 필드 없음, Codex 현행 유지).
- **매핑**: `documents-list.mapper.ts` → 계약 DTO 배열 + `nextCursor`.
- **커서**: `{completedAt, id}`를 base64url JSON. 복원 시 `(completedAt, id) < (cursorCompletedAt, cursorId)` 튜플 비교로 안정 페이지네이션. 매 요청 userId·retainUntil·status 재적용(커서는 위치만).

### 1-4. 계약 (packages/contracts/documents.ts, 신규)
```
documentListItemSchema = { documentId, completedAt(ISO), retainUntil(ISO),
  totalPageCount, analyzedPageCount, status: 'done'|'partial',
  risk: { high, medium, low }, label }
documentListResponseSchema = { items: [...], nextCursor: string | null }
```
- **위험 건수 기준 고정(계약 주석)**: `risk.{high,medium,low}`는 **공개 결과 조항의 riskLevel별 개수**. 화면의 "위험 N건"=high+medium+low 합, 색 점=존재하는 최고 severity(high>medium>low, 없으면 중립). 이 규칙을 계약·화면 양쪽에 고정.
- index.ts에 `export * from "./documents"`.

### 1-5. 앱 (apps/mobile/src/features/documents, 신규)
- **api** `documentsApi.ts`: `fetchRecentDocuments(token, cursor?)` → GET `/me/documents`, `documentListResponseSchema.parse`, 공유 `HttpError`.
- **model** `documentsStore.ts`(zustand): `{ status, items, nextCursor, refreshing }` + `refresh()`(첫 페이지 재조회)·`loadMore()`(append). **entitlement store를 복제하지 않음**(목록 특성: 페이지네이션·중복 제거·완료 후 갱신). 계정 격리: generation guard(요청 시작 시 세대 캡처, 응답 반영 전 비교, 로그아웃·계정변경 시 세대++ + items/cursor 제거).
- **갱신 트리거**: 상위 동기화 훅(기존 `useEntitlementSync` 패턴)에서 **분석 terminal 전이당 1회 + 홈 포커스**에 `refresh()`. analysis→documents 직접 import 금지(상위 조합).
- **ui**:
  - `RecentAnalysisSection.tsx`(홈): 상위 2~3개 + "모두 보기". 빈 상태/로딩/에러.
  - `RecentListScreen.tsx`(`app/recent.tsx` 라우트): 전체 목록 + `loadMore` 무한스크롤.
  - `DocumentRow.tsx`(공유 행): 썸네일 플레이스홀더(이미지 재열람=후속이므로 지금은 도큐먼트 아이콘), 라벨, 완료일 상대표기, 위험 점+건수, **삭제 배지**.
  - **삭제 배지 계산**: 서버 `retainUntil` 기준 `ceil((retainUntil-now)/1d)`일. `<1일`이면 "오늘 만료"(빨강), 그 외 "N일 후 삭제". 앱은 **표시만**(서버 값).
- **재열람 진입**: 행 탭 → 기존 ResultScreen으로 이동(documentId 전달) → `GET /documents/:id/analysis`로 조항 복원. 이미지 하이라이트는 후속(이번은 조항 목록 재열람). 410이면 "보관 기간이 지났어요" 안내 후 목록에서 제거.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 조회마다 `createdAt+7일` 계산(필드 없음) | 스키마 변경 없음 | 분석 소요시간 포함·정책 변경이 과거 문서 소급·확정 시점 불명확 | ❌ → completedAt/retainUntil 영속 |
| 재열람 게이트를 세션 expiresAt(24h)로 | 기존 필드 재사용 | 7일 보관과 모순(목록엔 보이는데 상세 410) | ❌ → retainUntil로 분리 |
| retainUntil 없이 목록 필터만 | 최소 변경 | 상세·스트림 재열람이 안 막혀 "7일 후 접근 종료" 미이행 | ❌ → 상세·스트림도 게이트 |
| 집계 캐시 컬럼(riskCount 등) 저장 | 목록 빠름 | 결과 교체 시 일관성 책임↑·근거 부족 | ❌(N4) → 매 요청 일괄 집계 |
| 이미지 하이라이트까지 이번에 | 확정 시안 100% | 이미지 수명·서명 URL 재발급·스냅샷 복원까지 범위 폭증 | ❌ → 바로 다음 이슈(N1) |
| 실삭제 잡 포함 | ADR 삭제 의무 이행 | 연쇄 삭제·접근↔삭제 지연 설계 필요 | ❌ → #74 바로 다음(N2). 이번은 접근 차단까지 |
| entitlement store 복제 | 빠른 구현 | 페이지네이션·중복제거·append 특성 불일치 | ❌ → 목록 전용 store(패턴만 재사용) |

## 3. 영향받는 코드 (Touched Surface)
- `packages/db/prisma/schema.prisma`: Document `completedAt`·`retainUntil` + 인덱스. 신규 마이그레이션(필드·인덱스·백필 SQL).
- `packages/db/src/analysis-ops.ts`: `reaggregateAndBump` terminal 분기에 completedAt/retainUntil 조건부 설정(done|partial). `RETENTION_DAYS` 상수.
- `packages/db/src/`(신규 or analysis-ops): `listRecentDocuments` 일괄 집계 쿼리(또는 repo에서 Prisma로).
- `apps/api/src/modules/documents/`: `documents-list.controller.ts`(신규)·`documents-list.mapper.ts`(신규)·`documents.service.ts`(listRecentDocuments)·`documents.repository.ts`(목록·집계 조회)·`documents.module.ts`(컨트롤러 등록).
- `apps/api/src/modules/documents/documents.service.ts`: `getAnalysis`에 retainUntil 게이트(410) — 또는 analysis.service 경유. (getStatus가 getAnalysis를 타므로 한 곳.)
- `packages/contracts/src/documents.ts`(신규) + index.ts.
- `apps/mobile/src/features/documents/`(신규): api·model(+test)·ui·index.
- `apps/mobile/app/index.tsx`(홈에 RecentAnalysisSection)·`app/recent.tsx`(신규 라우트)·상위 동기화 훅(갱신 배선)·ResultScreen 재열람 진입/410 처리.
- 단위 테스트(db·api·app) + e2e(.maestro) 시나리오.

## 4. 검증 (Verification)
- **단위(db)**: 보관 설정 1회(중복 settle로 연장 안 됨)·done|partial만 설정·백필 쿼리. 목록 집계 정확성(위험 riskLevel별·analyzed/total page·공개 결과 revision만, 다른 revision/실패 job 조항 미포함).
- **단위(api)**: 목록 필터(소유자·done|partial·retainUntil>now)·커서 안정성(동률 id tiebreak)·limit 상한. 재열람 게이트: retainUntil 미래=통과, 과거=410, null(진행중)=통과, 타 사용자=404.
- **단위(app)**: store 계정 격리(응답 세대 폐기)·loadMore append·중복 제거·410 시 목록 제거·삭제 배지 계산("오늘 만료" 경계).
- **e2e(.maestro)**: 홈 최근 섹션 표시 → 행 탭 → 조항 재열람. 목록 화면 페이지네이션. (보관 경계 24h/7일·계정 전환·410은 백엔드 seeding 필요 → 반자동/실측 후속.)
- **게이트**: `bash agents/harness/evals/checks.sh` PASS(타입·단위·expo-doctor·기록).

## 5. 리스크 / 롤백
- **마이그레이션 백필**이 대량 문서에서 느릴 수 있음 → 현재 데이터 소량, 단순 UPDATE. 문제 시 인덱스 먼저 생성 후 백필.
- **공개 결과 선택이 재분석(TASK-007) 도입 시 흔들림** → 지금 문서당 1 job 보장(활성 유니크+잠금). TASK-007에서 publishedAnalysisId 포인터 재검토(§PRD G3 규칙 유지).
- **접근 차단만·실삭제 없음** → 사용자에게 "7일 뒤 삭제" **공개 전** #74 필수(이번엔 내부 토대). 롤백: 게이트/목록/앱 화면은 독립 추가라 비활성화로 복구 가능.
- **이미지 하이라이트 미지원** → ResultScreen 재열람은 조항만; 이미지 영역은 placeholder/후속 안내. 다음 이슈에서 보강.
