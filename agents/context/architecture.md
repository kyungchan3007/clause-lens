# 시스템 아키텍처 (에이전트용 요약)

> 전체·다이어그램은 [README.md](../../README.md). 이 문서는 에이전트가 코드 쓰기 전에
> 읽어야 할 **책임 경계와 상태 모델**의 압축본입니다.
> 도메인별 상세 계약·불변조건은 [domain-map.md](domain-map.md) → 각 도메인 문서로.

## 3개의 실행 주체

| 주체 | 책임 | 이 저장소 포함? |
| --- | --- | --- |
| **Expo 앱** (프론트) | 촬영·Draft·업로드·상태 표시·Skia 하이라이트 | ✅ 이 repo |
| **NestJS API** | 인증·구독·문서/revision 기준·큐 등록(BullMQ)·결과 API | ❌ 별도 |
| **OCR Worker** | 큐 수신(BullMQ)·Vision 호출·좌표 정규화·위험 조항 분석·DB 저장 | ❌ 별도 |

**이 저장소는 Expo 앱(프론트)입니다.** API/Worker는 계약(API 형태)으로만 접합니다.

## 인프라 — Railway 단일 벤더 (결정 / ADR)

**결정**: 백엔드(NestJS API·OCR Worker)와 그 의존 서비스를 **전부 Railway 한 곳**에서 운영한다. **AWS를 직접 쓰지 않는다.**

| 컴포넌트 | 채택 | 자리 |
| --- | --- | --- |
| API 서버 | NestJS | Railway 서비스 |
| OCR Worker | Node 워커 | Railway 서비스 |
| DB | PostgreSQL | Railway 관리형 |
| **큐** | **Redis + BullMQ** | Railway 관리형 Redis |
| **오브젝트 스토리지** | **Railway Storage Bucket** (관리형 S3 호환) — 프로덕션 / **MinIO** — 로컬 개발 | Railway 관리형 / 로컬 docker-compose |
| 외부 OCR | Google Cloud Vision | 유일한 외부 의존 |

**근거**
- 초기·MVP 규모에 **단일 벤더 = 운영 표면 최소**. ECS/Fargate·IAM·리전 관리 회피.
- 큐를 BullMQ로 두면 API·Worker·DB·Queue가 **한 곳**에 모임(SQS는 Railway에 없음). NestJS 생태계에서 BullMQ가 사실상 표준.
- 스토리지는 **S3 호환 SDK**(`@aws-sdk/client-s3`)로 접근 → 프로덕션(Railway Bucket)·로컬(MinIO)·R2·S3 간 **엔드포인트·자격증명만 교체, 코드 0줄** 이전. `StoragePort` 어댑터로 격리.

**스토리지 결정 정정 (2026-09-15)** — 상세·비용은 [spec 0004](../intent/specs/0004-infra-decision-railway.md):
- 초기 ADR은 "MinIO(Railway 자체 호스팅)"였으나, "Railway엔 Volume뿐"이라는 **잘못된 전제**였음. Railway에 **관리형 Storage Bucket**이 존재.
- **비용**: Railway Bucket `$0.015/GB·월 + egress 무료` vs MinIO(상시 컨테이너 ~$3~5/월 + Volume `$0.15/GB·월`) → MVP 기준 **약 30~40배 저렴** + 백업·내구성·Presigned URL 관리형(운영부담 0).
- → **프로덕션 = Railway Storage Bucket**, **로컬 개발 = MinIO**(docker-compose). 둘 다 S3 호환이라 코드 동일.

**대안 & 미채택**
- *AWS SQS 유지* → Railway↔AWS 이중 관리(자격증명·리전·네트워크). 초기 복잡도 대비 이점 없음 → 미채택.
- *프로덕션 MinIO 자체 호스팅* → 상시 컨테이너 비용 + 자체 백업/내구성 부담. Railway Bucket이 더 싸고 관리형이라 **미채택(로컬 개발용으로만)**.
- *Cloudflare R2 / AWS S3* → 벤더 추가. Railway Bucket으로 단일 벤더 유지, 필요 시 코드 무변경 이전.

**배포 시 주의**: MinIO↔Railway Bucket은 대부분 호환이나 **path-style·region 서명·CORS** 등은 설정 수준 조정이 필요할 수 있음 → 배포 때 업로드 1회 실검증.

**불변조건 유지**: "앱은 스토리지에 **직접** 업로드하고, Presigned URL·`imageKey`는 API가 발급"하는 패턴은 그대로다. 아래 [절대 경계](#절대-경계-에이전트가-자주-어기는-것)의 "S3"는 모두 **S3 호환 스토리지**(프로덕션 Railway Bucket / 로컬 MinIO)를 뜻한다.

## BFF는 두지 않는다 (재검토 트리거 있음)

**결정**: 앱과 NestJS 사이에 **별도 BFF 계층을 두지 않는다.** NestJS가 이미 BFF 역할(앱 맞춤 응답, 하부 Vision·스토리지·큐 은닉)을 한다.

**이유** — 요청 수·비용은 BFF가 아니라 아래 3층 캐싱으로 푼다:
| 원하는 것 | 자리 |
| --- | --- |
| 앱 복귀 시 재요청 안 함 | 앱 메모리 캐시 (TanStack Query) — 네이티브는 백그라운드↔포그라운드에 메모리 유지 |
| 콜드 스타트에도 캐시 유지 | 앱 저장소 persist (MMKV / 웹은 localStorage) |
| 서버 원본 부하 | 필요 시 NestJS 내부 캐시(Redis/Cache-Control) — 계층 아님, 기능 |

> 핵심: BFF가 살아있어도 **요청은 기기에서 나간다**(BFF는 원본 부하만 줄임). "폰에서 요청을 없애는" 건 클라 캐시뿐이다. ClauseLens 데이터는 사적·개인별·미리계산이라 서버 공유 캐시 효율도 낮다.

**재검토 트리거** — 새 기능/API 연동 설계 시 아래 중 하나라도 YES면 검토(기본값은 "안 만듦"):
- [ ] 성격이 다른 클라이언트 2개+가 같은 데이터를 **다른 모양**으로 필요로 하나?
- [ ] 한 화면이 **독립 서비스 여러 개를 조합** 호출해야 하고, 앱이 하면 왕복이 여럿인가?
- [ ] 공개/파트너 API와 앱 전용 API의 **계약이 갈라지나**?

YES라도 **계층 추가 전에**: ① NestJS(현 BFF)에 집계/맞춤 엔드포인트로 되나? → 대개 여기서 끝. ② 그래도 안 되면 그때 별도 BFF 서비스. (이 검토는 [SDD 템플릿](../intent/templates/sdd.md)에 체크포인트로 포함)

## 절대 경계 (에이전트가 자주 어기는 것)

- 프론트는 **OCR을 실행하지 않고 위험 조항을 판단하지 않는다.** 서버 결과를 표현만.
- 프론트는 이미지를 오브젝트 스토리지(S3 호환 — 프로덕션 Railway Bucket / 로컬 MinIO)에 **직접** 업로드하되, Presigned URL·imageKey는 API가 발급한다.
- **서버가 진실의 기준.** 클라이언트 Draft는 화면 합성용 임시 상태일 뿐.

## 상태 모델

| 클라이언트 상태 | 서버 기준 상태 |
| --- | --- |
| 촬영 미리보기, 업로드 진행률 | 업로드 완료 이미지, 현재 revision |
| 선택 페이지·하이라이트 표시 여부/색 | OCR 작업 상태, 텍스트·원본 좌표 |
| 저장 전 Draft·임시 편집 | 위험 조항 분석 결과, 무료 횟수·구독 |

**합성 규칙**: 화면 = `서버 캐시 + 클라이언트 Draft`. 저장 성공 시 서버 재조회 후 Draft 제거. 충돌은 `revision`으로 판정, 최종 기준은 항상 서버.

## 핵심 계약 형태

분석 결과는 `clauses[].boxes[]` 좌표(원본 이미지 픽셀 기준)를 반환하고, 프론트가 표시 크기에 맞춰 스케일 변환 후 Skia로 그린다:

```ts
const scaleX = displayedWidth / imageWidth;
const scaleY = displayedHeight / imageHeight;
```

응답 JSON 전체 예시와 `revision` 무효화 규칙은 [README.md](../../README.md) 참조.

## 기술 스택 (프론트)

Expo SDK 57 · React Native 0.86.3 · Expo Router · React Native Skia 2.6.2 · (예정) TanStack Query · Zustand. **버전 고정 문서 필수**: https://docs.expo.dev/versions/v57.0.0/

## 디자인 시스템 & 모노레포 (결정)

**결정**: 요즘 현업 신규 Expo 앱의 최다·최저마찰 스택으로 간다.

- **스타일링**: **NativeWind** (Tailwind-RN). 토큰은 `tailwind.config`에서 관리, 다크모드 지원. (엔진 후보 중 Tamagui=무거움, Restyle/unistyles=타입이지만 reusables 비호환 → 마찰 최소인 NativeWind 채택)
- **컴포넌트**: **react-native-reusables** (RN판 shadcn). 라이브러리에 숨기지 않고 **코드를 repo에 소유**. NativeWind 위에서 동작. 헤드리스+`variant`/props로 도메인별 사용.
- **아이콘**: **lucide-react-native** (+ `react-native-svg`). 공유 `<Icon name size color>` 래퍼로 감싸 토큰 참조.

**토큰 3층 원칙** (컴포넌트는 primitive를 직접 쓰지 않는다):
```
primitive  blue-600 = #2563EB      (원시 팔레트)
  ↓
semantic   primary  = blue-600     (역할 — 컴포넌트는 이걸 쓴다)
  ↓
component  button-bg = primary     (선택)
```
브랜드 프라이머리 = **Cobalt `#2563EB`**. 리브랜딩/다크모드는 semantic만 교체.

**모노레포 구조**: pnpm workspace + **Turborepo**. 근거 = **백엔드+프론트가 계약(타입/스키마)을 공유** 하나. (오케스트레이터로 Nx도 후보였으나, 배포 단위 3개+패키지 소수 규모엔 과함 → Turborepo가 이 규모의 현업 표준.)
```
apps/
  mobile/     Expo 앱  ← 유일한 제품(프론트) 앱
  api/        NestJS
  worker/     OCR Worker
packages/
  contracts/  API 계약 = zod 스키마 (api + mobile 공유, 단일 소스). 순수 TS·런타임 중립
  db/         Prisma schema + client + 큐 job 타입 (api + worker 공유)
  tokens/     3층 디자인 토큰 + tailwind preset (모바일 전용)
  ui/         공유 디자인 시스템 — reusables 컴포넌트 + Icon 래퍼 (모바일 전용)
  config/     공유 tsconfig / eslint (+ 경계 규칙)
```
- **"앱"은 제품 기준 하나(mobile).** `api`·`worker`는 배포 단위이지 별도 제품이 아니다(모노레포 용어의 "app"일 뿐).
- UI/UX는 앱이 아니라 `packages/ui`로 **승격**해서 도메인이 props로 소비한다.
- **계약 공유 규율**: `contracts`는 순수 zod/타입만(Node·RN 의존성 0). RN이 서버 코드를 import 못 하도록 `eslint-plugin-boundaries`로 경계 강제.
- **Metro 모노레포 설정**(watchFolders·nodeModulesPaths·서버 코드 번들 제외)은 Expo 모노레포 대표 함정 → 기반 태스크에 포함.

> 미채택 & 보류: Tamagui(무거움) · Nx(이 규모엔 과함) · Style Dictionary/Figma 토큰 자동화(멀티플랫폼 트리거 오면) · 계약 방식 zod vs OpenAPI 코드젠(서버 착수 시 확정). 근거는 [JOURNAL](../JOURNAL.md).

## 앱 내부 아키텍처 — FSD (결정)

**결정**: `apps/mobile`은 **Feature-Sliced Design**으로 조직한다.
- **레이어(세로, 위→아래로만 import)**: screens · widgets · features · entities · shared — FSD-lite로 쓰는 것만.
- **세그먼트(가로, 슬라이스 내부)**: `ui` · `model` · `api` · `lib`. **"api"는 레이어가 아니라 세그먼트.**
- **디바이스 API 격리**: `expo-*`(카메라·권한) 호출은 훅/서비스로 감싸 UI에서 분리 — HTTP와 나란한 외부 경계.
- **zod 계약**: `packages/contracts`(서버+앱 단일 소스) → `shared/api`(parse) → `entities/api`. entity 타입 = `z.infer`.

레이어·세그먼트·import 경계·폴더맵·예시 상세: **[frontend-architecture.md](frontend-architecture.md)**.

## 백엔드 내부 아키텍처 — NestJS 모듈러 모놀리스 (결정)

**결정**: `apps/api`·`apps/worker`는 **모듈러 모놀리스 + 실용 3층 + 외부 경계만 포트**로 조직한다.
- **도메인 모듈**: auth · subscriptions · documents · uploads · analysis (프론트 domain-map과 같은 언어).
- **3층**: Controller(검증) → Service(로직) → Repository(Prisma). 풀 헥사고날/클린 아키텍처는 하지 않는다(MVP 과설계).
- **포트/어댑터는 외부 경계만**: Storage(프로덕션 Railway Bucket·로컬 MinIO) · Queue(BullMQ) · OCR(Vision) → 교체 자유.
- **ORM = Prisma.** DB 모델 단일 소스 = `packages/db/prisma/schema.prisma` (api·worker 공유). worker는 api를 import하지 않는다.
- **두 계약 층**: `packages/contracts`(zod=API) ↔ `packages/db`(Prisma=DB 모델). 서로 다른 층, Service가 매핑.

도메인 모듈·3층·포트·import 경계·폴더맵 상세: **[backend-architecture.md](backend-architecture.md)**. 결정 근거·대안: **[ADR 0005](../intent/specs/0005-backend-architecture.md)**.
