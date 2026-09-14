# 0004 — 인프라 결정 문서화 (Railway 단일 벤더)

> **관련 태스크**: #12 · **상태**: draft
> 실체(결정·대안·트레이드오프)는 [architecture.md — 인프라 결정(ADR)](../../context/architecture.md#인프라--railway-단일-벤더-결정--adr)에 있음. 이 spec은 과정 요약.

---

## PRD (왜/무엇)

### 1. 문제
기존 문서(README·architecture.md)는 큐를 AWS SQS, 스토리지를 AWS S3로 전제. 실제 배포는 **Railway 단일 벤더**로 정해졌는데 문서가 낡아, 두 AI(Claude·Codex)가 서로 다른 인프라를 가정할 위험.

### 2. 목표
- G1. 인프라 결정(Railway·BullMQ·MinIO)을 README·architecture.md에 정확히 반영.
- G2. AWS 직접 의존을 문서에서 제거(외부는 Google Vision만).

### 3. 비목표
- 실제 인프라 구축·NestJS 스캐폴드(후속 이슈 #13/#14).

### Acceptance
- [x] README·architecture.md의 SQS→BullMQ, S3→MinIO 반영, 다이어그램 갱신
- [x] architecture.md에 인프라 결정 ADR(근거·대안·트레이드오프) 존재
- [x] 게이트 PASS

---

## SDD (어떻게)

### 1. 읽은 문서
`README.md`(서버·인프라·다이어그램), `agents/context/architecture.md`.

### 2. 접근
architecture.md에 "인프라 — Railway 단일 벤더(ADR)" 섹션 신설 + 기존 SQS/S3 언급 정리. README 인프라 표·서버 구성·4개 mermaid 다이어그램의 `Amazon SQS`→`Redis·BullMQ`, `Amazon S3`→`MinIO` 치환 + 정의 노트.

### 3. 고려한 대안 · 트레이드오프 (요약 — 상세는 ADR)
| 주제 | 대안 | 결정 | 근거 |
| --- | --- | --- | --- |
| 큐 | AWS SQS 유지 | **Redis + BullMQ** | Railway엔 SQS 없음. 이중 관리(자격증명·리전) 회피, NestJS 표준. |
| 스토리지 | AWS S3 / R2 / MinIO 자체호스팅 | **Railway Storage Bucket**(프로덕션) + **MinIO**(로컬) | 관리형 S3 호환. 비용·운영 우위(아래). S3 SDK라 코드 무변경. |
| 배포 | ECS/Fargate 등 AWS | **Railway 단일** | MVP 규모에 운영 표면 최소. |

**스토리지 결정 정정 (2026-09-15)**: 초기엔 "MinIO(자체호스팅)"였으나 "Railway엔 Volume뿐"이라는 **잘못된 전제**였음. Railway에 **관리형 Storage Bucket**이 존재.
- **비용**(railway.com/pricing 실측): Storage Bucket `$0.015/GB·월 + egress 무료` vs MinIO(상시 컨테이너 ~$3~5/월 + Volume `$0.15/GB·월`). MVP(10GB 가정) ≈ **$0.15 vs $4.5~6.5**, 약 30~40배 차이. GB단가부터 Bucket이 Volume의 1/10.
- **운영**: Bucket은 백업·내구성·Presigned URL 관리형(부담 0), MinIO는 자체 운영.
- → **프로덕션 = Railway Storage Bucket, 로컬 개발 = MinIO**(공짜, 동일 S3 API). *프로덕션 MinIO 자체호스팅은 미채택.*
- **배포 주의**: path-style·region 서명·CORS는 구현체 차이가 있을 수 있어 배포 시 업로드 1회 실검증.

### 4. 파일
`README.md`, `agents/context/architecture.md`(+ 프론트 스택 RN 0.86.3 정정).

### 5. 위험 · 완화
- R1: 문서와 실제 배포가 다시 어긋남. **완화**: 실제 인프라 구축(#13/#14) 시 이 ADR을 기준으로.

### 6. 검증 (결과)
- 문서 잔여 `SQS`/`Amazon` 표기 제거 확인(ADR의 "미채택 SQS" 서술만 남김).
- 게이트 ALL PASS(문서 변경, 코드 영향 없음).
