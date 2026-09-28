<div align="center">

# 📸 ClauseLens

**계약서·약관을 촬영하면, 불리할 수 있는 조항을 원본 이미지 위에 짚어주는 모바일 앱**

OCR로 텍스트와 좌표를 추출하고 위험 조항을 분석해, 확인이 필요한 부분을 사진 위에 하이라이트합니다.

<br>

![Expo](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_+_BullMQ-DC382D?logo=redis&logoColor=white)
![Skia](https://img.shields.io/badge/RN_Skia-FF5252?logo=shopify&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo_+_pnpm-EF4444?logo=turborepo&logoColor=white)
![Platform](https://img.shields.io/badge/platform-iOS_%7C_Android-8A8A8A)
![Status](https://img.shields.io/badge/status-MVP_in_progress-F5A623)

</div>

> [!WARNING]
> ClauseLens의 분석 결과는 **참고 정보이며 법률 자문을 대체하지 않습니다.** 중요한 계약은 변호사 등 전문가의 검토를 권장합니다.

---

## 📑 목차

[프로젝트 현황](#-프로젝트-현황) · [핵심 기능](#-핵심-기능) · [모노레포 구조](#-모노레포-구조) · [기술 스택](#-기술-스택) · [책임 분리](#-프론트엔드와-백엔드의-책임) · [서버 구성](#-서버-구성) · [인프라](#-인프라) · [분석 흐름](#-전체-분석-흐름) · [상태 관리](#-상태-관리-원칙) · [분석 결과 예시](#-분석-결과-예시) · [실행 방법](#-실행-방법) · [로드맵](#-개발-로드맵)

---

## 📊 프로젝트 현황

<sup>업데이트: **2026-09-29**</sup>

> **MVP 구현 중** — `촬영 → 업로드(presign) → 분석요청·큐·상태폴링(SSE)` 파이프라인까지 **동작**합니다.
> 다음 작업은 **실제 OCR·위험조항·하이라이트(TASK-004)** 입니다.

| 영역 | 진행 |
| --- | --- |
| 🧱 기반 (모노레포·디자인시스템·인증) | **5 / 5 완료** |
| 🚀 기능 태스크 | **3 / 7 완료** · 1 진행 중 · 3 대기 |
| 🔗 파이프라인 | 촬영 · 업로드 · 분석요청/상태폴링 **동작** (OCR·하이라이트 미구현) |

### 기능별 상태

| 기능 | 상태 | 태스크 | 이슈 · PR |
| --- | --- | --- | --- |
| 계약서 촬영·불러오기·Draft | ✅ 완료 | TASK-001 | #3 |
| S3 호환 직접 업로드 (presign) | ✅ 완료 | TASK-002 | #15·PR#59 / #61·PR#62 |
| 분석 요청·jobId 상태 폴링 (SSE) | ✅ 완료 | TASK-003 | #63·PR#64 |
| OCR·위험조항 결과 + Skia 하이라이트 | 🔜 다음 | TASK-004 | — |
| 로그인 (카카오)·무료 분석 횟수 | 🟡 진행 중 | TASK-005 | #36 (로그인 완료) |
| 구독·문서 장기 저장 | ⬜ 대기 | TASK-006 | — |
| 특정 페이지 교체·부분 재분석 | ⬜ 대기 | TASK-007 | — |

<sup>범례: ✅ 완료 · 🟡 부분/진행 중 · 🔜 다음 · ⬜ 대기</sup>

---

## ✨ 핵심 기능

1. **📷 사진 찍기** — 계약서 직접 촬영 · 갤러리 선택 · 여러 페이지 관리 및 특정 페이지 교체
2. **🔍 분석하기** — Google Cloud Vision OCR로 텍스트·좌표 추출 → 자동 연장·위약금·해지 제한 등 위험 조항 분석 → Skia로 이미지 위 하이라이트. 사용자당 **3회 무료** 제공 예정
3. **💾 저장하기** — 분석한 계약서와 결과 보관 (장기 보관은 구독 기능으로 제공 예정)
4. **🔐 로그인** — 무료 분석 횟수 · 구독 상태 · 저장 문서 관리

---

## 🗂️ 모노레포 구조

**Turborepo + pnpm workspaces** 기반. 앱·API·워커를 한 저장소에서 관리하고, 공용 계약·토큰·UI를 패키지로 공유합니다.

```
clause-lens/
├─ apps/
│  ├─ mobile/     # 📱 Expo · React Native 앱 (Feature-Sliced Design)
│  ├─ api/        # 🛡️ NestJS API 서버 (인증·문서·업로드·분석 요청)
│  └─ worker/     # ⚙️ OCR Worker (BullMQ 소비자, OcrPort 어댑터)
├─ packages/
│  ├─ contracts/  # 🔗 zod 계약 — api ↔ mobile 공유 타입·런타임 검증
│  ├─ db/         # 🗃️ Prisma 스키마 · 분석 상태 전이 로직
│  ├─ tokens/     # 🎨 디자인 토큰 (3층 · NativeWind preset)
│  ├─ ui/         # 🧩 공유 UI 컴포넌트 (NativeWind)
│  └─ config/     # ⚙️ 공통 tsconfig 등
└─ agents/        # 🤖 에이전틱 엔지니어링 문서 (Intent·Context·Harness·Orchestration)
```

> **서버가 진실의 기준입니다.** 프론트엔드는 OCR을 실행하거나 위험 조항을 판단하지 않고, 서버 결과를 화면에 표현만 합니다. 기능→기능 직접 import를 금지하고 app 레이어에서 조합합니다(FSD).

---

## 🧱 기술 스택

| 구분 | 기술 | 역할 |
| --- | --- | --- |
| 모바일 | Expo · React Native · TypeScript | iOS와 Android 앱 개발 |
| 라우팅 | Expo Router | 화면 및 페이지 이동 관리 |
| 그래픽 | Shopify React Native Skia | OCR 좌표를 이용한 하이라이트 렌더링 |
| 클라이언트 상태 | Zustand | 촬영 페이지·선택 영역·Draft 상태 관리 |
| API 상태 | TanStack Query *(예정)* | 서버 데이터 조회·캐시·재요청 관리 |
| API 서버 | NestJS · Prisma | 인증·문서·업로드·분석 요청 오케스트레이션 |
| 워커 | NestJS(standalone) · BullMQ | 비동기 OCR·위험 조항 분석 |
| 데이터/큐 | PostgreSQL · Redis(BullMQ) | 문서·작업 상태 저장 · 작업 큐·상태 알림(pub/sub) |
| 실시간 | SSE (Redis pub/sub) | 분석 진행 상태 실시간 푸시 + GET 폴백 |
| iOS 빌드 | Xcode · CocoaPods | iOS 네이티브 의존성 빌드 |
| Android 빌드 | Android Studio · Android SDK | Android 앱과 에뮬레이터 빌드 |

Skia 내부에는 C++ 기반 그래픽 엔진과 iOS·Android 네이티브 연결 코드가 포함되어 있습니다. 앱에서는 설치된 라이브러리의 TypeScript API를 사용하므로, 현재 범위에서는 Swift·Kotlin·C++ 코드를 직접 작성하지 않습니다.

---

## 🧭 프론트엔드와 백엔드의 책임

### 프론트엔드 — Expo 앱

- 카메라 촬영과 갤러리 이미지 선택
- 촬영한 페이지의 순서 변경, 삭제, 교체
- 서버에 저장하기 전 이미지와 편집 내용을 Draft로 관리
- NestJS에 오브젝트 스토리지 업로드 URL 요청
- 발급받은 Presigned URL로 이미지를 스토리지에 직접 업로드
- 업로드 진행률과 실패·재시도 UI 처리
- NestJS에 분석 요청을 보내고 `jobId` 수신
- 분석이 끝날 때까지 작업 상태 조회
- 서버가 반환한 텍스트, 위험도, 좌표를 화면에 표시
- 원본 이미지 크기와 화면 표시 크기의 비율을 계산
- Skia로 이미지 위에 위험 조항 하이라이트 렌더링
- 하이라이트 색상, 투명도, 선택 상태 등 화면 표현 관리
- 로그인, 무료 분석 횟수, 구독 안내 화면 제공

프론트엔드는 OCR을 직접 실행하거나 위험 조항을 판단하지 않습니다. 서버가 반환한 결과를 사용자가 확인할 수 있도록 보여주는 역할을 담당합니다.

### 백엔드 — NestJS API Server

- 사용자 인증과 접근 권한 검증
- 무료 분석 3회와 구독 상태 검증
- 오브젝트 스토리지 Presigned URL과 안전한 `imageKey` 발급
- 문서, 페이지, 이미지, `revision` 관리
- 업로드 완료 여부 확인
- OCR 분석 작업을 큐(BullMQ)에 등록
- `jobId`와 작업 상태 관리
- 페이지 교체 시 이전 분석 결과 무효화
- 앱에 최신 문서와 분석 결과 제공
- 저장 및 장기 보관 권한 적용

### 백엔드 — OCR Worker

- 큐(BullMQ)에서 OCR 작업 수신
- 작업의 문서, 페이지, `revision` 유효성 확인
- 오브젝트 스토리지에서 분석할 이미지 조회
- Google Cloud Vision API 호출
- Vision 응답의 텍스트와 좌표를 앱에서 사용할 형식으로 정규화
- 자동 연장, 위약금, 해지 제한 등의 위험 조항 분석
- 위험도, 제목, 설명과 해당 문장의 좌표 연결
- PostgreSQL에 OCR와 분석 결과 저장
- 성공·실패 상태와 오류 정보 기록

### 책임 구분

| 기능 | 프론트엔드 | NestJS API | OCR Worker |
| --- | --- | --- | --- |
| 사진 촬영·선택 | 담당 | 하지 않음 | 하지 않음 |
| 이미지 Draft·미리보기 | 담당 | 하지 않음 | 하지 않음 |
| 스토리지 업로드 | Presigned URL로 직접 업로드 | URL과 imageKey 발급 | 이미지 조회만 수행 |
| 문서·페이지 관리 | 화면 조작 | 최종 데이터 저장 | 하지 않음 |
| OCR 실행 | 하지 않음 | 작업 등록만 수행 | Vision을 호출해 수행 |
| 위험 조항 분석 | 하지 않음 | 결과 조회 API 제공 | 분석 수행 |
| 좌표 하이라이트 | Skia로 렌더링 | 좌표 전달 | 좌표 정규화·저장 |
| 무료 횟수·구독 검증 | 안내 화면 표시 | 최종 권한 판단 | 하지 않음 |
| 작업 상태 | 조회하고 화면에 표시 | 최종 상태 제공 | 처리 상태 갱신 |
| 기준 데이터 | 임시 Draft와 캐시 | 문서·권한의 최종 기준 | 분석 결과 생성 |

### 책임 흐름

```mermaid
flowchart TB
    subgraph Frontend["프론트엔드 · Expo 앱"]
        Capture["촬영·선택"]
        Draft["페이지 Draft·미리보기"]
        Upload["스토리지 직접 업로드"]
        Highlight["Skia 하이라이트"]
    end

    subgraph APIArea["백엔드 · NestJS API"]
        Auth["인증·구독 검증"]
        Document["문서·페이지·revision"]
        Job["작업 등록·결과 API"]
    end

    subgraph WorkerArea["백엔드 · OCR Worker"]
        OCR["Google Vision 호출"]
        Analyze["위험 조항 분석"]
        Normalize["텍스트·좌표 정규화"]
    end

    Capture --> Draft --> Upload
    Upload --> Document
    Auth --> Document --> Job
    Job --> OCR --> Normalize --> Analyze
    Analyze --> Job --> Highlight
```

핵심 원칙은 다음과 같습니다.

- 프론트엔드는 사용자 입력과 화면 표현을 책임집니다.
- NestJS API는 인증, 권한, 문서 상태의 최종 기준입니다.
- OCR Worker는 무거운 OCR와 위험 조항 분석을 책임집니다.
- Google Cloud Vision은 텍스트와 좌표만 추출하며 서비스 정책을 판단하지 않습니다.

---

## 🖥️ 서버 구성

서버는 실행 책임을 기준으로 두 개로 분리합니다.

### 1. API Server — NestJS

- 로그인 및 사용자 관리
- 무료 분석 횟수와 구독 상태 확인
- 오브젝트 스토리지 Presigned URL 발급
- 문서, 세션, 페이지, revision 관리
- OCR 작업을 큐(BullMQ)에 등록
- 작업 상태와 분석 결과 조회 API 제공
- 저장 권한 및 구독 정책 처리

### 2. OCR Worker

- 큐(BullMQ)에서 분석 작업 수신
- 오브젝트 스토리지에서 원본 이미지 조회
- Google Cloud Vision API 호출
- OCR 텍스트와 좌표 정규화
- 위험 조항 분석 로직 실행
- 분석 결과를 PostgreSQL에 저장
- 작업 상태를 `queued`, `processing`, `done` / `partial` / `failed` 로 갱신

OCR Worker와 Google Cloud Vision은 서로 다른 구성입니다.

- **OCR Worker**: 우리가 개발하고 운영하는 작업 처리 서버
- **Google Cloud Vision**: Worker가 호출하는 외부 OCR 서비스

### 서버 아키텍처

```mermaid
flowchart TB
    App["Expo 모바일 앱"]

    subgraph Backend["우리 서버 영역 · Railway"]
        API["NestJS API Server"]
        Queue["Redis · BullMQ"]
        Worker["OCR Worker"]
        DB[("PostgreSQL")]
        S3[("오브젝트 스토리지 · Railway Bucket")]
    end

    Vision["Google Cloud Vision API · 외부"]

    App -->|"인증·문서·분석 API"| API
    API -->|"Presigned URL 발급"| App
    App -->|"이미지 직접 업로드"| S3
    API -->|"OCR 작업 등록"| Queue
    Queue -->|"비동기 작업 전달"| Worker
    Worker -->|"원본 이미지 조회"| S3
    Worker -->|"OCR 요청"| Vision
    Vision -->|"텍스트·좌표 반환"| Worker
    API -->|"문서·작업 조회/저장"| DB
    Worker -->|"OCR·분석 결과 저장"| DB
    Worker -.->|"상태 알림 (pub/sub)"| API
    API -.->|"SSE 실시간 푸시"| App
```

NestJS API Server와 OCR Worker는 배포와 실행 책임이 분리된 두 개의 서버입니다. API Server는 모바일 요청에 빠르게 응답하고, 시간이 오래 걸리는 OCR와 분석은 Worker가 비동기로 처리합니다. 진행 상태는 **Redis pub/sub → SSE** 로 앱에 실시간 전달하고, 끊기면 GET 조회로 복원합니다.

---

## ☁️ 인프라

**배포는 Railway 단일 벤더입니다. AWS를 직접 사용하지 않습니다.** 백엔드(API·Worker)와 의존 서비스(DB·큐·스토리지)를 모두 Railway에서 운영하고, 외부 의존은 Google Cloud Vision 하나뿐입니다. 결정 근거·대안·트레이드오프는 [architecture.md — 인프라 결정(ADR)](agents/context/architecture.md#인프라--railway-단일-벤더-결정--adr).

> 이 문서에서 **"S3"** 는 *S3 호환 오브젝트 스토리지*를 의미합니다. 실제 구현은 **프로덕션 = Railway Storage Bucket(관리형)**, **로컬 개발 = MinIO**(docker-compose)입니다. 접근은 표준 S3 SDK라 엔드포인트·자격증명만 교체하면 되고, R2·AWS S3로도 코드 변경 없이 이전할 수 있습니다.

| 기술 | 역할 | 위치 |
| --- | --- | --- |
| Railway Storage Bucket (S3 호환) | 계약서 원본 이미지 저장 (프로덕션) · 로컬은 MinIO | Railway 관리형 / 로컬 docker-compose |
| Redis + BullMQ | OCR 비동기 작업 큐 · 상태 알림 pub/sub | Railway 관리형 Redis |
| PostgreSQL | 사용자, 문서, 페이지, 작업 상태, 분석 결과 저장 | Railway 관리형 |
| NestJS | 모바일 앱용 API 서버 | Railway 서비스 |
| OCR Worker | OCR 호출과 위험 조항 분석 수행 | Railway 서비스 |
| Google Cloud Vision | 이미지에서 텍스트와 좌표 추출 | 외부 API (유일한 외부 의존) |

---

## 🔄 전체 분석 흐름

```mermaid
sequenceDiagram
    actor User as 사용자
    participant App as Expo 앱
    participant API as NestJS API
    participant S3 as 오브젝트 스토리지
    participant Queue as Redis · BullMQ
    participant Worker as OCR Worker
    participant Vision as Google Vision
    participant DB as PostgreSQL

    User->>App: 계약서 촬영 또는 선택
    App->>API: 업로드 URL 요청
    API-->>App: Presigned URL과 imageKey 반환
    App->>S3: 이미지 직접 업로드
    App->>API: 업로드 완료 및 분석 요청
    API->>DB: 문서와 페이지 생성
    API->>Queue: OCR 작업 등록
    API-->>App: jobId와 PROCESSING 반환
    Queue->>Worker: 작업 전달
    Worker->>S3: 이미지 조회
    Worker->>Vision: OCR 요청
    Vision-->>Worker: 텍스트와 좌표 반환
    Worker->>Worker: 좌표 정규화 및 위험 조항 분석
    Worker->>DB: OCR와 분석 결과 저장
    Worker->>DB: 상태를 COMPLETED로 변경
    App->>API: jobId 결과 조회
    API->>DB: 최신 결과 조회
    API-->>App: 이미지 정보와 하이라이트 좌표 반환
    App->>App: Skia로 하이라이트 표시
```

## ♻️ 페이지 이미지 교체 흐름

```mermaid
sequenceDiagram
    actor User as 사용자
    participant App as Expo 앱
    participant API as NestJS API
    participant S3 as 오브젝트 스토리지
    participant Queue as Redis · BullMQ
    participant Worker as OCR Worker
    participant Vision as Google Vision
    participant DB as PostgreSQL

    User->>App: 교체할 페이지에서 새 이미지 선택
    App->>App: 클라이언트 Draft 미리보기
    App->>API: 교체 이미지 업로드 URL 요청
    API-->>App: Presigned URL과 새 imageKey 반환
    App->>S3: 새 이미지 직접 업로드
    App->>API: 페이지 교체 요청
    API->>DB: imageKey 교체 및 revision 증가
    API->>DB: 이전 OCR·분석 결과 무효화
    API->>Queue: 해당 페이지와 revision 재분석 작업 등록
    API-->>App: PROCESSING 상태 반환
    Queue->>Worker: 페이지 재분석 작업 전달
    Worker->>DB: 현재 revision 확인
    Worker->>S3: 새 이미지 조회
    Worker->>Vision: OCR 요청
    Vision-->>Worker: 새 텍스트와 좌표 반환
    Worker->>Worker: 위험 조항 재분석
    Worker->>DB: 현재 revision의 결과 저장
    Worker->>DB: 상태를 COMPLETED로 변경
    App->>API: 최신 페이지 결과 조회
    API->>DB: 현재 revision 결과 조회
    API-->>App: 새 이미지와 하이라이트 좌표 반환
    App->>App: Draft 제거 후 서버 결과로 동기화
```

Worker는 작업에 포함된 `revision`과 DB의 현재 `revision`을 비교합니다. 이미지가 다시 교체되어 오래된 작업이 된 경우에는 결과를 저장하지 않습니다.

## 🗄️ 상태 관리 원칙

서버 상태를 최종 기준으로 사용합니다.

| 클라이언트에서 관리 | 서버에서 관리 |
| --- | --- |
| 촬영 중인 이미지 미리보기 | 업로드가 완료된 이미지 정보 |
| 업로드 진행률 | 문서와 페이지의 현재 revision |
| 선택한 페이지와 화면 상태 | OCR 작업 상태 |
| 하이라이트 표시 여부와 색상 | OCR 텍스트와 원본 좌표 |
| 서버에 저장하기 전 Draft | 위험 조항 분석 결과 |
| 임시 편집 내용 | 무료 사용 횟수와 구독 상태 |

클라이언트와 서버의 상태를 물리적으로 하나로 합치지는 않습니다. 서버 데이터를 기준 상태로 두고, 클라이언트 Draft를 화면에서 합성해 보여줍니다. 저장 또는 분석 요청이 완료되면 서버의 최신 데이터로 다시 동기화합니다.

### 상태 결합 및 동기화 흐름

```mermaid
flowchart TB
    Server["서버 기준 상태<br>문서·페이지·revision·분석 결과"]
    Cache["API 캐시<br>서버 상태의 클라이언트 복사본"]
    Draft["클라이언트 Draft<br>촬영·미리보기·임시 편집"]
    View["사용자 화면"]
    Save["업로드·저장·분석 요청"]

    Server -->|"조회"| Cache
    Cache -->|"기본 데이터"| View
    Draft -->|"임시 변경 합성"| View
    View -->|"확정"| Save
    Save -->|"서버 반영"| Server
    Server -->|"최신 결과 재조회"| Cache
    Cache -->|"동기화 완료"| Draft
```

- 편집 중에는 `서버 상태 + 클라이언트 Draft`를 합쳐 화면에 표시합니다.
- 저장이 성공하면 서버 상태를 다시 조회하고 해당 Draft를 제거합니다.
- 충돌 여부는 `revision`으로 판단하며 최종 기준은 항상 서버입니다.

## 🧾 분석 결과 예시

Google Cloud Vision은 `자동 연장` 같은 위험 조항의 제목을 만들어 주지 않습니다. Vision은 OCR 텍스트와 위치를 반환하고, OCR Worker의 분석 단계가 위험 조항의 제목·설명·위험도를 생성합니다.

```json
{
  "jobId": "job_01",
  "status": "COMPLETED",
  "documentId": "doc_01",
  "page": {
    "pageId": "page_02",
    "revision": 3,
    "imageKey": "documents/doc_01/page_02-r3.jpg",
    "imageWidth": 2480,
    "imageHeight": 3508
  },
  "clauses": [
    {
      "id": "clause_01",
      "type": "AUTO_RENEWAL",
      "title": "자동 연장",
      "text": "별도의 의사표시가 없는 경우 본 계약은 동일한 조건으로 자동 연장됩니다.",
      "riskLevel": "HIGH",
      "boxes": [
        {
          "x": 312,
          "y": 1420,
          "width": 1710,
          "height": 108
        }
      ]
    }
  ]
}
```

Skia는 `boxes` 좌표를 화면에 표시된 이미지 크기에 맞게 변환하여 사각형을 그립니다. 하이라이트 색상과 투명도는 앱에서 자유롭게 지정할 수 있습니다.

```ts
const scaleX = displayedWidth / imageWidth;
const scaleY = displayedHeight / imageHeight;

const highlight = {
  x: box.x * scaleX,
  y: box.y * scaleY,
  width: box.width * scaleX,
  height: box.height * scaleY,
  color: "rgba(255, 80, 80, 0.35)",
};
```

## ⚙️ 개발 환경

| 도구 | 버전 |
| --- | --- |
| Node.js | 22 |
| pnpm | 11 |
| Expo SDK | 57 |
| React Native | 0.86.3 |
| React Native Skia | 2.6.2 |
| Java | 21 |
| Xcode | 26 |
| CocoaPods | 1.17 |
| Android Studio · SDK | 최신 |

## ▶️ 실행 방법

```bash
pnpm install
pnpm exec expo start
```

개발 빌드 실행:

```bash
pnpm exec expo run:ios
pnpm exec expo run:android
```

환경 점검:

```bash
pnpm dlx expo-doctor
```

완료 게이트 (typecheck · build · prisma · 단위 테스트 등 통과해야 "done"):

```bash
bash agents/harness/evals/checks.sh
```

## 🗺️ 개발 로드맵

| # | 단계 | 상태 | 태스크 |
| --- | --- | --- | --- |
| 1 | 촬영·갤러리 이미지 선택 화면 | ✅ 완료 | TASK-001 |
| 2 | 여러 페이지와 Draft 상태 관리 | ✅ 완료 | TASK-001 |
| 3 | NestJS Presigned URL 연동·직접 업로드 | ✅ 완료 | TASK-002 |
| 4 | 분석 작업 요청과 상태 조회(SSE) | ✅ 완료 | TASK-003 |
| 5 | OCR·위험 조항 결과 + Skia 하이라이트 | 🔜 다음 | TASK-004 |
| 6 | 로그인과 무료 분석 횟수 | 🟡 진행 중 | TASK-005 |
| 7 | 구독 및 문서 저장 | ⬜ 대기 | TASK-006 |
| 8 | 특정 페이지 교체·부분 재분석 | ⬜ 대기 | TASK-007 |

---

<div align="center">
<sub>🤖 이 저장소는 Claude Code · Codex 두 AI가 동일한 규칙(<a href="AGENTS.md">AGENTS.md</a>)으로 협업하는 <b>에이전틱 엔지니어링</b> 방식으로 개발됩니다.</sub>
</div>
