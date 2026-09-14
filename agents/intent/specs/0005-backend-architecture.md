# 0005 — 백엔드 아키텍처 결정 (ADR)

> **관련 태스크**: #26 · **상태**: approved
> 지침서(상세)는 [backend-architecture.md](../../context/backend-architecture.md). 이 문서는 **결정과 대안·근거**(ADR).

---

## PRD (왜/무엇)

### 1. 문제
NestJS 백엔드의 **내부 아키텍처가 미정**이었음. 프론트는 FSD로 정해졌으나 api·worker의 코드 조직·ORM·레이아웃 기준이 없어, 두 AI가 제각기 짜면 일관성이 깨짐.

### 2. 목표
- G1. api·worker의 코드 조직 규칙을 확정하고 문서로 강제.
- G2. ORM·모노레포 레이아웃을 결정.

### 3. 비목표
- 실제 스캐폴드·엔드포인트 구현(#14 이후).

### Acceptance
- [x] backend-architecture.md(지침서) + architecture.md 결정 섹션 + guardrails 경계 규칙 존재
- [x] ORM·레이아웃·레이어링 결정과 대안이 기록됨
- [x] 게이트 PASS

---

## SDD (어떻게 / 결정과 대안)

### 결정 요약
모듈러 모놀리스 · Controller→Service→Repository 3층 · 외부 경계만 포트 · Prisma(`packages/db`) · `apps/*`+`packages/*` 레이아웃 · zod(API)/Prisma(DB) 계약 층 분리.

### 대안 1 — 레이어링
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 실용 3층 (Controller/Service/Repository) | 단순·NestJS 관례·빠른 학습 | 대규모 도메인엔 얕을 수 있음 | ✅ |
| 헥사고날/클린 아키텍처 | 경계 엄격·테스트 용이 | MVP엔 과설계·보일러플레이트 | ❌ (외부 경계만 포트로 부분 채택) |
| CQRS(@nestjs/cqrs) | 읽기/쓰기 분리 | 지금 복잡도 불필요 | ❌ |

### 대안 2 — ORM
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| **Prisma** | 마이그레이션·Studio·문서 성숙, 초심자 안전 | 별도 스키마 언어·codegen, 런타임 무거움 | ✅ |
| Drizzle | TS-first(스키마도 TS)·경량·SQL근접·타입 극강 | 생태계·마이그레이션 상대적으로 젊음 | ❌ (TS-first 통일 원하면 재검토) |
| TypeORM | NestJS 예제 다수 | 유지보수·타입안전 이슈, 신규 비주류 | ❌ |
근거: 사용자가 백엔드가 처음에 가까워 **DX·안전한 레일** 우선. zod 계약과 무충돌(DB 모델≠API DTO).

### 대안 3 — 모노레포 레이아웃
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| **`apps/*` + `packages/*`** | Turborepo/Nx/pnpm 관례, 예제 그대로, 공유패키지 자리 명확 | front/back이 이름으로만 구분 | ✅ |
| `front/` + `backend/` + `packages/` | front/back 시각적 그룹 | 관례 이탈(예제 번역), 공유패키지 위치 애매, front=1·backend=2 비대칭 | ❌ |
근거: 의미 있는 축은 "front vs back"이 아니라 **"배포 앱 vs 공유 라이브러리"**. `apps/` 내 이름(mobile/api/worker)으로 front/back 이미 구분됨.

### 대안 4 — api/worker 코드 공유
- **채택**: 공유물(Prisma·엔티티·큐 job 타입)을 `packages/db`로. worker는 api를 import하지 않음.
- 대안(worker가 api import) ❌ — 배포 단위 결합·순환 위험.

### 검증 (결과)
- 문서(backend-architecture.md·architecture.md·guardrails·AGENTS.md) 생성/갱신.
- 게이트 ALL PASS(문서 변경).
- **미검증**: 실제 코드 구조는 #14(NestJS 스캐폴드)에서 이 기준으로 구현·검증.
