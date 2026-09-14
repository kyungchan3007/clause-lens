# 백엔드 내부 아키텍처 — NestJS 모듈러 모놀리스

> `apps/api`(NestJS API)·`apps/worker`(OCR Worker)의 **코드 조직 규칙**. 시스템 주체·계약·인프라는 [architecture.md](architecture.md).
> 프론트(`apps/mobile`)는 [FSD](frontend-architecture.md)를 따르며 이 문서 대상 아님.

## 원칙: 모듈러 모놀리스 + 실용 3층 + 외부 경계만 포트

- **모듈러 모놀리스**: 도메인별 NestJS 모듈로 나눈다. 마이크로서비스로 쪼개지 않는다(MVP 규모에 과함).
- **실용 3층**: `Controller`(입력·검증) → `Service`(도메인 로직) → `Repository`(영속성). 풀 헥사고날/클린 아키텍처는 **하지 않는다**.
- **외부 경계만 포트(인터페이스)로 추상화**: 스토리지·큐·OCR. 나머지는 직접 구현. → 교체 자유(MinIO→R2, Vision→다른 OCR)를 코드 무변경으로.

## 도메인 모듈 (프론트 domain-map과 같은 언어)

| 모듈 | 책임 |
| --- | --- |
| **auth** | 인증·세션·접근 권한 |
| **subscriptions** | 무료 분석 횟수·구독 상태(entitlement) |
| **documents** | 문서·페이지·`revision` 관리 |
| **uploads** | Presigned URL·안전한 `imageKey` 발급 (`POST /uploads/presign`) |
| **analysis** | OCR 작업 등록(BullMQ producer)·상태·결과 조회 API |

> 도메인 계약·불변조건은 [domain-map.md](domain-map.md) → 각 도메인 문서.

## 모듈 내부 구조 (3층)

```
apps/api/src/modules/uploads/
  uploads.controller.ts   HTTP 경계 — zod(nestjs-zod)로 요청 검증
  uploads.service.ts      도메인 로직 — 포트/Repository 호출
  uploads.repository.ts   Prisma 접근 (필요할 때만; 단순 모듈은 생략 가능)
  uploads.module.ts       DI 배선
```

- **Controller**: 얇게. 입출력 검증(zod)·인증 가드·Service 호출만. 비즈니스 로직 금지.
- **Service**: 도메인 로직의 자리. 외부 자원은 **포트 인터페이스**로만 접근.
- **Repository**: Prisma 쿼리 격리. Service가 Prisma를 직접 부르지 않는다.

## 외부 경계 — 포트 & 어댑터

```
apps/<api|worker>/src/
  ports/      storage.port.ts · queue.port.ts · ocr.port.ts   (인터페이스)
  adapters/   minio-storage.adapter.ts · bullmq-queue.adapter.ts · vision-ocr.adapter.ts
```
- Service는 `StoragePort`·`QueuePort`·`OcrPort`에만 의존. 구현(MinIO/BullMQ/Vision)은 DI로 주입.
- 인프라 교체 시 어댑터만 교체. → [architecture.md 인프라 ADR](architecture.md#인프라--railway-단일-벤더-결정--adr)

## API ↔ Worker 관계

- 둘 다 NestJS, **별도 배포 단위**. `apps/api`=HTTP 서버, `apps/worker`=NestJS **standalone**(HTTP 없음, BullMQ consumer).
- **worker는 api를 import하지 않는다.** 공유가 필요한 것(DB·엔티티·큐 job 타입)은 `packages/db`로 뺀다.
- 흐름: api가 `analysis` 작업을 큐에 넣음(producer) → worker의 processor가 꺼내(consumer) Vision 호출 → 결과 DB 저장.

## 두 개의 계약 층 (분리, 정상)

```
packages/db          Prisma schema = DB 모델 단일 소스   (api·worker 공유)
packages/contracts   zod 스키마     = API 계약 단일 소스  (api·mobile 공유)
```
- **DB 모델 ≠ API DTO.** Service가 그 사이를 매핑한다(Prisma row → zod 응답).
- Prisma가 `packages/db`에 있는 이유: api·worker **둘 다** DB가 필요 → 앱에 두면 한쪽이 다른 앱을 import하게 됨.

```
packages/db/
  prisma/schema.prisma     DB 모델
  src/client.ts            PrismaClient 싱글턴
  src/jobs.ts              큐 job 타입 (api가 넣고 worker가 꺼냄)
  src/index.ts
```

## import·의존 경계 규칙 (강제)

- **층 방향**: Controller → Service → Repository. 역방향 금지(Repository가 Service를 모른다).
- **외부 자원은 포트로만**: Service에서 Prisma·SDK·fetch 직접 호출 금지(Repository/adapter 경유).
- **worker → api import 금지.** 공유는 `packages/db`·`packages/contracts`로.
- **비밀값은 env로만**(하드코딩 금지), 민감정보 로그 금지. → [guardrails](../harness/guardrails.md)

## ORM — Prisma (결정)

- **Prisma 채택.** 근거: 마이그레이션·Studio·문서가 성숙해 백엔드 초심자도 안전하게 속도. 대안 Drizzle(TS-first·경량)·TypeORM(레거시)은 [ADR](../intent/specs/0005-backend-architecture.md) 참조.
- 스키마 단일 소스 = `packages/db/prisma/schema.prisma`. 마이그레이션은 Prisma Migrate.

## 과설계 금지

- 빈 레이어·포트를 미리 만들지 않는다. Repository·포트는 **필요해질 때** 추가.
- 구체 태스크의 파일 배치는 각 [spec](../intent/specs/)에서 다룬다(이 문서는 태스크에 결합하지 않는다).
