# 프론트엔드 앱 내부 아키텍처 — FSD

> `apps/mobile`(Expo 앱)의 **코드 조직 규칙**. 시스템 주체·계약·상태는 [architecture.md](architecture.md).
> 백엔드(`apps/api`·`apps/worker`)는 NestJS 모듈 구조를 따르며 FSD 대상 아님.

## 원칙: React 감각 그대로 + 디바이스 API 격리

RN도 React → 웹의 분리(마크업 / 로직 훅 / API 레이어)가 그대로 전이. 모바일 고유 추가점 3가지:
- **디바이스·네이티브 API**(카메라·권한·파일)가 HTTP와 나란히 또 하나의 외부 경계 → 훅/서비스로 감싸 UI에서 격리
- **Expo Router**(파일 기반)가 screens 역할
- 플랫폼 분기 파일 `*.ios.tsx` / `*.native.tsx`

## 두 축: 레이어(세로) · 세그먼트(가로)

### 레이어 — 위에서 아래로만 import
| 레이어 | 역할 | 모바일 메모 |
| --- | --- | --- |
| **app** | provider·초기화 | expo-router 루트 설정 |
| **screens** | 라우트 조합 | `app/` 파일이 겸함(얇게) |
| **widgets** | 큰 복합 UI 블록 | 재사용·복합일 때만 |
| **features** | 사용자 액션(동사) | capture, analyze … |
| **entities** | 도메인 명사 | document·page·clause … ([domain-map](domain-map.md)) |
| **shared** | ui kit·api client·lib·config | `packages/ui`·`tokens`도 shared 성격(크로스앱) |

### 세그먼트 — 각 슬라이스 내부
```
features/capture/
  ui/     마크업 (View/Text + NativeWind)
  model/  훅·스토어 (로직) — store, useXxx
  api/    데이터 접근 (해당 contract 사용)
  lib/    슬라이스 전용 유틸
```
> **"api"는 레이어가 아니라 세그먼트.** 각 슬라이스 안의 `api/` + 공통 `shared/api`.

## import 경계 규칙 (강제)
- **상위 레이어만 import**: screens→widgets→features→entities→shared. 역방향 금지.
- **entities는 features를 import하지 않는다** (명사는 동사를 모른다).
- 같은 레이어의 다른 슬라이스끼리 직접 import 금지 — 교차는 상위 레이어에서 조합.
- 강제 수단: `@feature-sliced/steiger` 또는 `eslint-plugin-boundaries`. → [guardrails](../harness/guardrails.md)

## zod 계약 흐름 (서버-앱 단일 소스)
```
packages/contracts   zod 스키마 (서버 검증 + 앱 타입, 단일 소스)
     │ import
     ▼
shared/api           HTTP client + schema.parse(응답 검증)
     │
     ▼
entities/<x>/api      엔티티별 요청 (해당 contract 사용)
     │
     ▼
features → widgets → screens
```
- **entity 타입 = `z.infer<typeof Schema>`** → 런타임 검증 + 타입이 한 소스에서.
- 서버 상태는 TanStack Query, 클라 상태는 Zustand. → [architecture.md § 상태 모델](architecture.md)

## 폴더 맵 (FSD-lite — 쓰는 것만)
```
packages/
  contracts/  ui/  tokens/  config/     ← 크로스앱 shared

apps/mobile/src/
  features/   capture, analyze …
  entities/   document, page …          (도메인 로직이 생길 때)
  shared/     api(zod client), lib, hooks
  (widgets/   복합 블록이 재사용될 때 추가)
  (app/       라우트 파일이 screens 역할)
```
> **과설계 금지**: 빈 레이어를 미리 만들지 않는다. `widgets`·`entities`는 필요해질 때 추가.

## 상태 배치 원칙
- **클라 임시 상태**(편집 중 Draft 등)는 해당 feature의 `model`에 둔다.
- **서버 도메인 명사**가 되는 순간 `entities`로 승격한다(그때 zod contract 연결).
- 구체 태스크의 파일 배치는 각 [spec](../intent/specs/)에서 다룬다(이 문서는 태스크에 결합하지 않는다).
