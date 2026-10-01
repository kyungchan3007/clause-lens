# 0045 — 과정 기록 (trace)

## 판단
- 미러 대상으로 db 대신 `packages/contracts` 패턴을 택함: db는 prisma generated client를 main으로 가리키는 특수 패키지라 순수 TS 라이브러리(infra)엔 contracts의 `tsc→dist` 구조가 1:1로 맞았다. 빌드 방식(`tsc -p tsconfig.json`)은 db·contracts 공통이라 규칙 위반 아님.
- S3는 api가 NestJS `ConfigService`, worker가 `process.env`로 env를 읽는 차이가 있어 infra가 어느 한쪽에 묶이지 않도록 `EnvReader { required, optional }` 인터페이스로 추상화. api는 ConfigService를 감싼 reader를 인라인 생성, worker는 infra의 `processEnvReader` 사용.
- `createRedis(opts?)` 시그니처는 호출부(api·worker 5곳)가 전부 인자 없이 호출하므로 **그대로 유지**해 동작 불변·배선 최소화. 과제의 "createRedis(env)" 문구는 통합 취지로 해석.
- S3Client **생성 블록만** 통합, presign/head/copy/delete/getObject 오퍼레이션 메서드와 bucket은 각 어댑터에 남김(책임·의존이 api/worker에서 상이, 동작 변경 위험 회피).

## 막힘 / 되돌림
- PreToolUse 기록 강제 훅이 spec 폴더(prd/sdd) 선행을 요구 → 코드 수정 전에 0045 폴더부터 작성.
- checks.sh가 api·worker 타입체크 전 contracts·db를 선행 빌드하는 패턴 확인 → infra도 `Build (infra)` 단계를 타입체크 앞에 추가해 dist 타입 해석 보장.
