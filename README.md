<div align="center">

# 📸 ClauseLens

**계약서를 촬영하면, 확인이 필요한 조항을 원본 이미지 위에 표시하는 모바일 앱**

OCR로 계약서의 텍스트와 좌표를 추출하고 위험 조항을 분석해, 해당 위치를 사진 위에 하이라이트합니다.

<br>

![Expo](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Skia](https://img.shields.io/badge/RN_Skia-FF5252?logo=shopify&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_+_BullMQ-DC382D?logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

<br>

<img src="docs/images/00-hero.png" width="100%" alt="ClauseLens 로그인 · 홈 · 위험 조항 하이라이트 화면" />

<img src="docs/images/01-analyze.png" width="49%" alt="분석 진행 화면" />
<img src="docs/images/02-result.png" width="49%" alt="결과 · 보관 화면" />

</div>

| 항목 | 내용 |
| --- | --- |
| 기간 | 2026.09 – 2026.10 |
| 팀 구성 | 2인 팀 (기획 1 · 개발 1) |
| 담당 | 개발 전담 — React Native 앱 · NestJS API · OCR Worker · 인프라 |
| 상태 | MVP 개발 완료 · 서비스 미배포 |
| 상세 문서 | [포트폴리오 (Notion)](https://shaded-badger-c05.notion.site/ClauseLens-3eddeddc12a781269cc2e96862e1e4b1) · [개발 기록 (Notion)](https://shaded-badger-c05.notion.site/OCR-3d1deddc12a780f0bb7fc1f8403287a5) |

> [!WARNING]
> ClauseLens의 분석 결과는 **참고 정보이며 법률 자문을 대체하지 않습니다.** 중요한 계약은 변호사 등 전문가의 검토를 권장합니다.

## 📌 해결한 문제

1. **동시성 제어:** 동시 요청 시 무료 횟수가 중복 차감되는 문제를 예약 · 정산 2단계 처리로 해결하고, 결제 웹훅 · 업로드 · 재시도 작업까지 같은 원칙으로 확장했습니다.
2. **좌표 정합:** EXIF 회전으로 어긋나는 OCR 좌표를 서버 정규화 이미지 기준으로 통일해, 원본 사진 위 하이라이트와 터치 판정을 일치시켰습니다.
3. **비동기 파이프라인 안정성:** 큐 등록 누락 · 작업 중단 · 늦은 응답을 전제로 재등록과 상태 버전을 설계해, 연결이 끊겨도 분석 상태를 복원하도록 했습니다.

---

## 🎯 핵심 기술

### 1. 동시 요청에도 한 번만 처리되는 무료 횟수 집행

동시·중복 요청에서도 무료 분석 횟수가 정책을 넘지 않도록 **예약 → 정산** 2단계로 집행했습니다.

- **문제:** 1회 남은 사용자가 동시에 2번 요청하면 둘 다 통과해 횟수가 음수가 될 수 있었습니다.
- **해결:** 접수 시 조건부 UPDATE로 횟수를 원자적으로 예약하고, 분석이 완료된 경우에만 차감하며 실패·부분 완료는 예약을 해제했습니다. jobId 원장과 문서 잠금으로 중복 예약·정산을 차단했습니다.
- **검증:** PostgreSQL 통합 테스트(**7개 시나리오 · 13개 판정**) 과정에서 **중복 차감 버그를 발견**해 조건부 상태 전이로 수정했습니다. 가용 1회 기준 **동시 8건 중 예약 1건**, **동일 문서 6건 중 Job·예약 각 1건**을 확인했습니다.
- **확장:** 같은 원칙을 결제 웹훅 중복 수신, 업로드 중복 요청, 재시도 작업 중복 실행 방지에 적용했습니다.

<sub>자세히 → [인증·이용 권한](agents/context/auth-entitlement.md)</sub>

### 2. OCR 좌표를 원본 사진 위에 정확히 복원

정규화 이미지와 OCR 좌표 기준을 통일하고 이미지·위험 구역을 같은 Skia Canvas에 렌더링해, **촬영 편차에서도 하이라이트 위치와 터치 선택을 일치**시켰습니다.

- **문제:** 휴대폰 사진의 EXIF 회전 정보 때문에 OCR 좌표와 화면 속 이미지 방향이 어긋날 수 있었고, 페이지 전환 중 이전 이미지와 현재 좌표가 섞일 위험이 있었습니다.
- **해결:** Worker에서 방향을 보정한 이미지를 저장하고 좌표와 같은 버전으로 묶어 내려줬습니다. 앱은 화면 비율·여백을 계산해 좌표를 역변환하고 **44pt 터치 영역 · 작은 영역 우선 판정**을 적용했습니다.
- **메모리 제한:** **24MP · 8192px 초과 이미지는 SVG로 대체 렌더링**해 디코드 메모리 위험을 제한했습니다.
- **검증:** 좌표 변환·터치 판정 단위 테스트, 실제 Vision 결과의 OCR 위치 일치, 페이지 전환 시 이전 이미지·현재 좌표 혼합 미발생을 확인했습니다.

<sub>자세히 → [하이라이트 렌더링](agents/context/highlight-rendering.md) · [프론트 아키텍처](agents/context/frontend-architecture.md)</sub>

### 3. 끊겨도 이어지는 비동기 분석 파이프라인

API와 BullMQ Worker를 분리하고 DB를 기준 상태로 두어, **분석이 길어지거나 모바일 연결이 끊겨도 작업을 이어가고 재진입 시 최신 상태를 복원**했습니다.

- **흐름:** 업로드 → 분석 요청 → 큐 → Worker(Vision OCR · Claude) → SSE · 폴링으로 상태 전달
- **문제:** 외부 OCR·AI API의 처리 시간 편차, DB Job 생성 후 큐 등록 실패, 재진입·네트워크 전환 시 SSE 이벤트 유실이 발생할 수 있었습니다.
- **해결:** 작업 ID를 먼저 반환하고 **최대 3회 지수 백오프**로 재시도하며, **30초 이상 미전달 작업은 큐에 다시 등록**했습니다. 결과 저장과 상태 변경을 한 트랜잭션으로 묶고 상태 버전으로 **늦게 도착한 응답이 최신 상태를 덮어쓰지 않도록** 차단했습니다.
- **상태 복원:** SSE와 5초 주기 조회로 상태를 보정하고, 오류 시 2초 후 재연결했습니다.
- **검증:** 반복 요청 시 Job 재사용, 미전달 Job 자동 재등록, SSE 오류 후 상태 복원, 역순 응답 차단을 확인했습니다.

<sub>자세히 → [분석 잡](agents/context/analysis-job.md) · [백엔드 아키텍처](agents/context/backend-architecture.md)</sub>

---

## 🏗️ 아키텍처

- **Mobile** — 촬영 · 업로드 · 상태 표시 · 결과 하이라이트
- **API** — 인증 · 권한 · 문서 상태 · 작업 접수
- **Worker** — OCR · 위험 조항 분석 · 결과 저장

<img src="docs/images/architecture.png" width="100%" alt="ClauseLens 아키텍처: Mobile App → API Server → Job Queue → OCR Worker → Google Vision · Claude, PostgreSQL · Object Storage" />

<sub>전체 요청 흐름 → [백엔드 아키텍처](agents/context/backend-architecture.md) · [업로드·스토리지](agents/context/upload-storage.md)</sub>

---

## ⚖️ 기술 선택과 비용 검토

| 결정 | 비교 | 선택 |
| --- | --- | --- |
| 이미지 저장소 | MinIO 직접 운영 vs Railway Storage Bucket | 프로덕션 Railway Bucket · 로컬 MinIO |
| 비동기 작업 큐 | AWS SQS vs Redis + BullMQ | Redis + BullMQ |
| 모노레포 | Nx vs Turborepo | Turborepo |
| 결과 렌더링 | Image + SVG vs Skia | Skia 중심 · SVG 대체 렌더링 |

> **이미지 저장소** — MinIO를 프로덕션에서 직접 운영하면 상시 컨테이너·Volume과 백업·내구성 관리가 필요했습니다. 10GB 기준 당시 검토 비용이 **월 약 $4.5~6.5에서 약 $0.15**로 줄어 Railway Bucket을 선택했고, S3 호환 Storage Adapter로 로컬 MinIO와 같은 코드를 유지했습니다.

<sub>결정 근거 → [아키텍처 — 인프라 결정](agents/context/architecture.md)</sub>

---

## 🧩 함께 다룬 주제

- **디자인 시스템 · FSD** — 3층 디자인 토큰과 공용 UI 패키지(`packages/ui`), Feature-Sliced 구조로 기능 간 직접 참조를 막고 `app` 레이어에서 조합했습니다. → [프론트 아키텍처](agents/context/frontend-architecture.md)
- **보관 · 삭제 상태 머신** — 분석 결과를 `임시 보관(7일) → 저장 / 만료 → 삭제`로 전이하고, 삭제 전 감사 기록과 멱등 삭제로 중단 시에도 안전하게 재개했습니다. → [도메인 맵](agents/context/domain-map.md)
- **AI 협업 하네스** — Claude · Codex가 같은 규칙(spec → 구현 → 검증 게이트 → 기록)으로 작업하도록, spec 없는 코드 수정 차단과 완료 게이트를 적용했습니다. → [하네스](agents/harness/README.md)

---

## 🗂️ 모노레포 구조

**Turborepo + pnpm workspaces** — 앱·API·Worker를 한 저장소에서 관리하고, 공용 계약·토큰·UI를 패키지로 공유합니다.

```
clause-lens/
├─ apps/
│  ├─ mobile/     # 📱 Expo · React Native 앱 (Feature-Sliced Design)
│  ├─ api/        # 🛡️ NestJS API 서버 (인증·문서·업로드·분석 요청)
│  └─ worker/     # ⚙️ OCR Worker (BullMQ 소비자)
├─ packages/
│  ├─ contracts/  # 🔗 zod 계약 — api ↔ mobile 공유 타입·런타임 검증
│  ├─ db/         # 🗃️ Prisma 스키마 · 분석/보관 상태 전이
│  ├─ tokens/     # 🎨 디자인 토큰
│  ├─ ui/         # 🧩 공유 UI 컴포넌트
│  └─ config/     # ⚙️ 공통 설정
└─ agents/        # 🤖 설계·규칙 문서
```

## 🧰 기술 스택

| 영역 | 기술 |
| --- | --- |
| 모바일 | Expo · React Native · TypeScript · React Native Skia · NativeWind · Zustand |
| API · Worker | NestJS · Zod · BullMQ |
| 데이터 | Prisma · PostgreSQL · Redis |
| OCR · 분석 | Google Cloud Vision · Claude |
| 스토리지 · 배포 | Railway (Storage Bucket · PostgreSQL · Redis) · 로컬 MinIO |
| 검증 | 단위 테스트 · PostgreSQL 통합 테스트 · Maestro |

<details>
<summary><b>⚙️ 개발 환경 · 실행</b></summary>

| 도구 | 버전 | | 도구 | 버전 |
| --- | --- | --- | --- | --- |
| Node.js | 22 | | React Native | 0.86.3 |
| pnpm | 11 | | React Native Skia | 2.6.2 |
| Expo SDK | 57 | | Java | 21 |
| Xcode | 26 | | CocoaPods | 1.17 |

```bash
pnpm install
pnpm exec expo start          # 개발 서버
pnpm exec expo run:ios        # 개발 빌드
pnpm exec expo run:android
bash agents/harness/evals/checks.sh   # 완료 게이트
```

</details>
