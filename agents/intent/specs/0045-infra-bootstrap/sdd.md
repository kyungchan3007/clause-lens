# 0045 — infra 부트스트랩 — SDD

> **관련 PRD:** 0045-infra-bootstrap/prd.md · 상태: draft

## 1. 접근 방식 (Approach)
`packages/contracts`(순수 TS 라이브러리: `tsc` → `dist`, main/types) 패턴을 **미러링**해 `packages/infra`를 만든다. pnpm workspace의 `packages/*` 글롭과 turbo의 script-name 기반 task가 자동 포함하므로 별도 등록은 불필요.

- `src/redis.ts`: `redisUrl()`·`channelPrefix()`·`createRedis(opts?)`를 **현 시그니처 그대로** 이전(동작 불변). ioredis 의존.
- `src/s3.ts`: `createS3Client(config)` + `parseS3Config(env)`(EnvReader 추상화) + `processEnvReader`(worker용). EnvReader는 `{ required(k), optional(k) }` 인터페이스라 infra가 @nestjs/config에 의존하지 않는다. api는 ConfigService를 감싼 reader를 2줄로 만들어 넘긴다.
- api·worker는 각자의 `redis.config.ts`를 infra re-export로 축소하거나 import 경로만 교체. S3 어댑터는 생성 블록만 `createS3Client(parseS3Config(reader))`로 교체하고 bucket·오퍼레이션 메서드는 유지.
- 소비 측 타입 해석을 위해 checks.sh에 `Build (infra)` 단계를 api·worker 타입체크 **앞**에 추가(contracts·db와 동일 선행 빌드 패턴).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| A. 생성 블록만 infra로, 오퍼레이션은 어댑터 유지 | 동작 불변 보장 쉬움, 범위 최소 | 어댑터에 얇은 배선 남음 | ✅ |
| B. 전체 StoragePort 구현을 infra로 이전 | 어댑터 완전 제거 | api(presign/copy)·worker(getObject) 책임·의존 상이, 동작 변경 위험, 범위 밖 | ❌ |
| C. `createRedis(env)`로 시그니처 변경해 env 주입 | 테스트 주입 용이 | 호출부 전부 변경·동작 불변 깨질 위험 | ❌ (현 시그니처 유지) |

## 3. 영향받는 코드 (Touched Surface)
- 신규: `packages/infra/{package.json,tsconfig.json,src/index.ts,src/redis.ts,src/s3.ts,test/*}`
- 수정: `apps/api/src/adapters/redis.config.ts`·`redis-notification.adapter.ts`·`bullmq-queue.adapter.ts`·`minio-storage.adapter.ts`, `apps/worker/src/redis.config.ts`·`main.ts`·`notification.publisher.ts`·`adapters/s3-storage.adapter.ts`, 두 앱 `package.json`.
- 새 의존성: api·worker에 `@clause-lens/infra: workspace:*`. infra는 ioredis·@aws-sdk/client-s3 의존.

## 4. 데이터 / 계약 (Contracts)
외부 API 계약 변화 없음. EnvReader 내부 계약: `required(key)→string(없으면 throw)`, `optional(key)→string|undefined`. S3Config: endpoint·region·forcePathStyle·accessKeyId·secretAccessKey. **BFF 트리거 체크**: 해당 없음(새 외부 연동 아님).

## 5. 위험과 완화 (Risks)
- R1 기본값·파싱 미묘한 차이로 동작 변경 → 완화: 기존 리터럴을 그대로 복사하고 단위 테스트로 기본값·forcePathStyle 파싱·maxRetries 고정을 못박음.
- R2 소비 측 타입 해석 실패(dist 미생성) → 완화: checks.sh에 선행 `Build (infra)` 추가.

## 6. 롤아웃 / 되돌리기
단일 PR. 문제 시 revert로 복구(순수 구조 변경이라 데이터·마이그레이션 영향 없음).

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` PASS — api·worker 타입체크·기존 유닛 테스트.
- 신규 infra 단위 테스트: `createRedis` 기본 옵션(maxRetriesPerRequest: null)·`parseS3Config` 기본값·`createS3Client` 생성 검증.
