# 0006 — 로컬 개발 환경 (docker-compose)

> **관련 태스크**: #13 · **상태**: draft
> 인프라 결정은 [architecture.md 인프라 ADR](../../context/architecture.md#인프라--railway-단일-벤더-결정--adr).

---

## PRD (왜/무엇)

### 1. 문제
백엔드(api·worker)를 개발하려면 의존 서비스 3종(**PostgreSQL·Redis·MinIO**)이 로컬에 필요. Railway에 매번 올려가며 개발하면 주기가 느림. 프로덕션과 **동일한 S3 호환 인터페이스(MinIO)** 를 로컬에서 재현해야 코드가 환경 간 일치.

### 2. 목표
- G1. `docker compose up` 한 번으로 Postgres·Redis·MinIO 기동.
- G2. MinIO 버킷 자동 생성 + 콘솔 접근.
- G3. 접속 정보를 `.env.example`로 문서화(실제 비밀값 커밋 금지).

### 3. 비목표
- NestJS 앱 자체(#14)·Presigned 엔드포인트(#15). 프로덕션 Railway 배포.

### 4. 제약
- 비밀값 하드코딩/커밋 금지(로컬 throwaway 자격증명은 `.env` 기본값). pnpm만.

### Acceptance
- [ ] `docker compose up`으로 3종 기동, healthcheck 통과
- [ ] MinIO 콘솔(:9001) 접속 + 버킷 자동 생성 확인
- [ ] `.env.example` 존재, 실제 `.env`는 gitignore
- [ ] `environment.md`에 기동·중지 절차 기록

---

## SDD (어떻게)

### 1. 읽은 문서
architecture.md(인프라 ADR·backend), backend-architecture.md, `.gitignore`, `environment.md`.

### 2. 접근
루트 `docker-compose.yml`에 postgres/redis/minio + `createbuckets`(minio/mc 원샷) 서비스. 자격증명·포트·버킷명은 `.env`(없으면 compose 기본값)로. `.env.example`에 항목 정의. `environment.md`에 절차.

### 3. 고려한 대안 · 트레이드오프
| 주제 | 대안 | 결정 | 근거 |
| --- | --- | --- | --- |
| 스토리지 | Postgres 볼륨/로컬 FS | **MinIO** | 프로덕션(MinIO)과 동일 S3 API·Presigned 재현. 환경 일치. |
| 버킷 생성 | 수동/앱 부팅 시 | **compose `createbuckets`(mc) 원샷** | up 한 번으로 완결, 재현성. |
| 자격증명 | compose에 하드코딩 | **`.env` + 기본값(`${VAR:-default}`)** | 비밀값 커밋 금지 원칙, 그래도 up은 무설정 동작. |
| 이미지 태그 | latest | **핀(postgres:17-alpine·redis:7-alpine)** / minio는 최신 | 재현성. minio는 date 태그라 주기적 갱신. |
| MinIO 이미지 출처 | Docker Hub `minio/minio`·`minio/mc` | **quay.io/minio/\*** | MinIO가 Docker Hub 배포 중단 → `minio/mc` pull 불가(실측). quay.io가 공식. |
| MinIO 준비 대기 | compose healthcheck + `condition: service_healthy` | **createbuckets가 `until`로 직접 재시도** | 서버 이미지에 `mc` 없어 healthcheck 불안정 → mc 붙을 때까지 재시도가 견고. |

### 4. 파일·순서
1. `docker-compose.yml` (postgres·redis·minio·createbuckets + volumes·healthcheck)
2. `.env.example` (DB/Redis/S3 접속 항목)
3. `.gitignore`에 `.env` 추가
4. `agents/harness/environment.md` 로컬 인프라 절차

### 5. 위험 · 완화
- R1: 포트 충돌(5432/6379/9000/9001). **완화**: environment.md에 명시, 필요 시 .env로 포트 변경.
- R2: 로컬 자격증명 노출 오해. **완화**: throwaway 명시 + 실제 `.env` gitignore.

### 6. 검증 (결과)
- `docker compose config`로 문법·스키마 검증(데몬 불필요) → 이 커밋에서 수행.
- **미검증(정직)**: 이 환경은 docker 데몬 미실행이라 실제 `up`·healthcheck·버킷 생성은 로컬에서 못 돌림 → 사용자 머신에서 관측 필요.
