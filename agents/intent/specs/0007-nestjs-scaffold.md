# 0007 — NestJS API 스캐폴드 + packages/db(Prisma)

> **관련 태스크**: #14 · **상태**: draft
> 아키텍처: [backend-architecture.md](../../context/backend-architecture.md) · [architecture.md 백엔드 결정](../../context/architecture.md)

---

## PRD (왜/무엇)

### 1. 문제
백엔드가 `apps/api`에 `.gitkeep`만 있는 빈 상태. 실제 엔드포인트(#15 presign) 전에 **부팅되는 뼈대**와 DB 접근 계층이 필요.

### 2. 목표
- G1. `apps/api`에 NestJS 프로젝트 생성, 모노레포(pnpm+turbo)에 편입.
- G2. `packages/db`에 Prisma 세팅(schema + client). api·worker 공유 준비.
- G3. `GET /health`로 서버 부팅·응답 확인.
- G4. 완료 게이트(`checks.sh`)에 api·db typecheck 편입.

### 3. 비목표
- 실제 도메인 모듈/엔드포인트(#15~), DB 모델 정의(엔티티는 후속), 인증, 실제 Railway 배포.

### 4. 제약
- 비밀값 하드코딩 금지(env로만). pnpm만. 백엔드 3층·포트 경계 준수. `worker`는 `api` import 금지.

### Acceptance
- [x] 서버 부팅(빌드 후 `node dist/main.js`) — 실 DB 없이 `DATABASE_URL` env만으로 성공
- [x] `GET /health` → 200 `{"status":"ok","timestamp":...}`
- [x] `prisma generate` 성공(DB 불필요), 고정 경로 `packages/db/generated/client`
- [x] `checks.sh` PASS (api typecheck + Prisma validate 포함, 6/6)
- [x] 비밀값이 코드/커밋에 없음(env 참조만)

---

## SDD (어떻게)

### 1. 읽은 문서
`backend-architecture.md`, `architecture.md`(백엔드 결정), 루트 `package.json`·`turbo.json`·`pnpm-workspace.yaml`, `packages/config/tsconfig.base.json`, `apps/mobile/tsconfig.json`.

### 2. 접근
NestJS 11 + Prisma 6. `nest new` 대신 **수동 스캐폴드**(모노레포 통제·불필요 파일 회피). `packages/db`는 Prisma schema + PrismaClient 싱글턴, `postinstall: prisma generate`로 client 확보(DB 연결 불필요). api는 3층 폴더 골조 + health 모듈. **부팅 시 DB 연결 강제 안 함**(Prisma는 첫 쿼리에 지연 연결) → docker 없이도 부팅·게이트 통과.

### 3. 고려한 대안 · 트레이드오프
| 주제 | 대안 | 결정 | 근거 |
| --- | --- | --- | --- |
| 스캐폴드 방식 | `nest new` CLI | **수동 생성** | CLI는 자체 git·불필요 설정 생성. 모노레포에 수동이 통제 쉬움. |
| Prisma client 위치 | api 내부 | **`packages/db`** | api·worker 공유(아키텍처). worker가 api import 방지. |
| health의 DB 체크 | 부팅 시 connect + DB 상태 반환 | **liveness만(`status:ok`)** | 부팅에 DB 강제하면 docker 없이 안 뜸. DB readiness는 후속(별도 엔드포인트). |
| 빌드러너 | webpack(nest 기본) | **tsc** | 단순·turbo typecheck와 일관. |

### 4. 파일·순서
1. `packages/db/` — `package.json`(@clause-lens/db, prisma·@prisma/client, postinstall generate), `prisma/schema.prisma`(datasource postgres `DATABASE_URL` + generator, 모델은 후속), `src/client.ts`(PrismaClient 싱글턴), `src/index.ts`, `tsconfig.json`
2. `apps/api/` — `package.json`(@clause-lens/api, nest deps + @clause-lens/db workspace), `tsconfig.json`·`tsconfig.build.json`, `nest-cli.json`, `.gitignore`(dist)
3. `apps/api/src/` — `main.ts`(bootstrap, PORT env), `app.module.ts`(ConfigModule.forRoot isGlobal + HealthModule + DbModule), `modules/health/{health.controller,health.module}.ts`, `db/{prisma.service,db.module}.ts`(전역, 지연연결·onModuleDestroy disconnect)
4. `checks.sh` — api·db typecheck 추가. 루트 `.gitignore`에 `dist`·prisma generated 반영 확인.
5. 게이트 실행.

### 5. 위험 · 완화
- R1: `@prisma/client` 미생성 시 typecheck FAIL → **`postinstall: prisma generate`**(DB 불필요)로 항상 생성.
- R2: 부팅 시 DB 강제로 docker 없이 안 뜸 → 지연 연결(연결은 첫 쿼리/후속 readiness).
- R3: Nest 데코레이터 메타데이터 → tsconfig `experimentalDecorators`·`emitDecoratorMetadata` 필수.

### 6. 검증 (결과)
- `checks.sh` **6/6 PASS**(mobile·api typecheck + Prisma validate + expo-doctor + lockfile + native 단일버전).
- **부팅·`/health` 200 실측**: `nest build` → `DATABASE_URL=... node dist/main.js` → `curl /health` = `{"status":"ok",...}`. **실 DB 없이** 성공(Prisma 지연 연결).
- **발견·해결한 함정**:
  1. `@prisma/client`가 pnpm에서 **typescript peer 변형별로 2개** 생성(ts@6.0.3/5.9.3) → generate와 런타임이 다른 변형을 봐 "did not initialize". **해결: generator `output`을 고정 경로(`packages/db/generated/client`)로** → 변형 해싱과 무관. api는 `@clause-lens/db`(생성 JS)에서 import.
  2. `PrismaClient` 생성 시 **`DATABASE_URL` env 필요**(연결은 아님) → 로컬은 `.env`(spec 0006)에서 주입.
  3. pnpm 10 빌드 스크립트 승인: `@prisma/client`·`@prisma/engines`·`prisma`를 `allowBuilds`에 추가.
- **미검증(정직)**: 실 DB 연결·마이그레이션은 docker 필요 → #15에서.
- 부수: expo 패치 드리프트(expo·expo-image-picker) 재발 → `expo install --fix`로 정렬(반복 이슈, CI/#22에서 근본 대응 예정).
