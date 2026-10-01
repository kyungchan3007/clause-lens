# 0045 — infra 부트스트랩 (@clause-lens/infra) — PRD

> **이슈:** #129 · 상태: in-progress · 유형: refactor · 갱신: 2026-10-02

## 문제
- api·worker가 Redis 연결 설정(`redisUrl`/`channelPrefix`/`createRedis`)을 **글자 그대로 복제**해 두 벌로 들고 있다 (`apps/api/src/adapters/redis.config.ts`, `apps/worker/src/redis.config.ts`).
- S3 호환 클라이언트 **생성 블록**(endpoint·region·forcePathStyle·credentials)도 두 어댑터에서 동일 로직이 복제돼 있다 (`minio-storage.adapter.ts`, `s3-storage.adapter.ts`).
- 복제본이 어긋나면(기본값·maxRetries·forcePathStyle 파싱 등) api와 worker가 서로 다른 인프라 규약을 쓰게 돼 디버깅이 어렵다.

## 목표
- G1. 신규 워크스페이스 패키지 `@clause-lens/infra`를 만들어 Redis 연결 헬퍼를 **단일 출처**로 통합.
- G2. S3Client **생성 블록**과 env 파싱 헬퍼를 infra로 통합(오퍼레이션 메서드는 각 어댑터 유지).
- G3. api·worker가 infra를 소비하도록 재배선하고 중복 파일/로직을 제거. **동작 불변**.

## 목표가 아닌 것 (Non-goals)
- N1. Prisma 서비스·`@clause-lens/db` 통합은 범위 밖 (건드리지 않음).
- N2. presign/head/copy/delete/getObject 등 **오퍼레이션 메서드**의 infra 이전은 범위 밖 (각 어댑터 유지, 동작 불변).
- N3. Redis/S3 런타임 동작·기본값 변경 없음 (순수 구조 리팩토링).

## 4. 사용자 흐름 (User Flow)
해당 없음 — 내부 인프라 리팩토링. 사용자 가시 동작 변화 없음.

## 5. 성공 지표
- `bash agents/harness/evals/checks.sh` PASS (타입체크·기존 테스트 포함).
- redis.config 복제 파일 제거, S3Client 생성 로직 단일화.

## 6. 제약
- 서버가 진실의 기준. api(NestJS ConfigService)·worker(process.env) 두 환경 읽기 방식 모두 지원해야 함.
- 동작 불변: 기본값(`redis://localhost:6379`, `cl`, `us-east-1`, `maxRetriesPerRequest: null`, forcePathStyle 파싱)을 그대로 보존.

## Acceptance
- [x] `packages/infra`(@clause-lens/infra) 생성 — `createRedis`/`redisUrl`/`channelPrefix` + `createS3Client`/`parseS3Config` 제공
- [x] api·worker가 `@clause-lens/infra` 소비하도록 재배선, redis.config 복제 제거
- [x] S3Client 생성 블록 단일화 (오퍼레이션 메서드는 각 어댑터 유지)
- [x] `createRedis`/`createS3Client` 단위 테스트 추가
- [x] 게이트(checks.sh) PASS
