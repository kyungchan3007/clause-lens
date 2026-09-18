# 0008 — 인증(Auth): 소셜 로그인(Kakao) + JWT 세션

> **관련 태스크**: #32 · **상태**: draft
> 정책: [Notion 01. 제품 기획](https://shaded-badger-c05.notion.site/OCR-3d1deddc12a780f0bb7fc1f8403287a5) · 아키텍처: [backend-architecture.md](../../context/backend-architecture.md)
> **depends**: #14(NestJS 스캐폴드) · **unblocks**: documents/pages · uploads presign(#15) · analysis · 구독

## 제공자 결정 (2026-09-18)
- **MVP = Kakao 단일.** Apple은 **iOS App Store 정식 출시 전까지 보류(deferred)**.
- ⚠️ **App Store Guideline 4.8**: iOS 앱이 소셜 로그인을 제공하면 Apple은 **Sign in with Apple도 제공**하라고 요구 → **iOS 정식 출시 시 Apple 추가 필수**(그 전 개발·테스트·Android는 카카오만으로 무방).
- Apple 미채택 근거: 지금 Apple Developer 유료($99/년)·세팅 비용을 미루고 카카오로 검증 우선. iOS 출시 준비 단계에서 Apple 재개(별도 태스크).

---

## PRD (왜/무엇)

### 1. 문제
앱은 근본적으로 per-user(무료 3회·구독·저장·소유권). 서버 도메인의 토대인 **인증**이 없으면 문서·업로드·분석에 소유권을 얹을 수 없다.

### 2. 목표
- G1. **카카오 소셜 로그인** → 우리 **JWT 세션** 발급.
- G2. **`User` 모델**(최초 실 DB 모델·마이그레이션).
- G3. 보호 엔드포인트 접근 제어(`JwtAuthGuard` + `@CurrentUser`).
- G4. 토큰 재발급(refresh).

### 3. 비목표
- **Apple 로그인(iOS 출시 전 별도 태스크)**, 이메일/비밀번호, 구독·결제, 비회원 임시 분석. **앱 로그인 UI/SDK 연동은 별도 태스크**(이 spec은 백엔드).

### 4. 제약 (Guardrails)
- **비밀번호 직접 취급 안 함**(소셜만). 소셜/JWT 시크릿은 **env로만**(하드코딩 금지).
- **토큰·PII·provider 원문 응답을 로그에 남기지 않음**.
- 소유권 미확인 리소스 반환 금지. 무료횟수·권한은 서버 최종 판단(이 태스크는 인증까지, entitlement 로직은 후속).

### Acceptance
- [x] `POST /auth/kakao`(앱 access token) → provider 검증 → user upsert → `{ accessToken, refreshToken, user }` *(구현·부팅 검증. 실 카카오 토큰 e2e는 앱+실기기 후속)*
- [x] `POST /auth/refresh` → 회전된 새 토큰 *(구현 완료, DB 흐름은 마이그레이션 후)*
- [x] `GET /auth/me`(보호) → 미인증 시 **401 실측 확인**
- [x] `User`·`RefreshToken` 마이그레이션 적용 — **docker Postgres에서 `migrate dev` 실측**(테이블 생성 + `/auth/refresh` DB 경로 401 확인)
- [x] `checks.sh` PASS(6/6) · 비밀값 env only · 민감정보 로그 없음

---

## SDD (어떻게)

### 1. 읽은 문서
Notion `01. 제품 기획`(로그인 정책)·`02. 사용자 기능 §9`·`05. NestJS API 설계`·`08. 인프라·배포`, repo `backend-architecture.md`·`architecture.md`.

### 2. 결정: (A) 앱 주도 + 네이티브 SDK (현업 모바일 표준)
앱이 카카오 네이티브 SDK로 로그인 → **access token** 획득 → 백엔드에 전달 → **백엔드가 카카오 API로 검증 후 우리 JWT 발급**. 백엔드는 **stateless**(OAuth 핸드셰이크용 서버 세션/`state` 저장 불필요, 웹 리다이렉트 아님).

- **Kakao**: 앱 카카오 SDK(**네이티브 앱 키는 카카오 콘솔 참조** — 문서/코드에 값 넣지 않음, 앱 config/env로 주입) → **access token** → 백엔드가 `GET https://kapi.kakao.com/v2/user/me` (Bearer)로 **검증·프로필** → upsert.
- 번들 ID/패키지명 = `com.chan.clauselens` (카카오 콘솔 플랫폼 등록 완료 대상). 로그인 리다이렉트 스킴 = `kakao{NATIVE_APP_KEY}` (실제 키 값은 콘솔·env 참조).

### 3. 고려한 대안 · 트레이드오프
| 주제 | 대안 | 결정 | 근거 |
| --- | --- | --- | --- |
| OAuth 주도 | (B) 백엔드 주도 웹 OAuth(state Redis 저장·콜백) | **(A) 앱 주도 네이티브 SDK** | 모바일 UX(원탭) 우수, 백엔드 stateless, dev build라 네이티브 모듈 가능. |
| 제공자 | Kakao + Apple 동시 · Google · 이메일/비번 | **Kakao 단일(Apple deferred)** | Apple 유료·세팅 비용 미루고 카카오로 검증 우선. **단 iOS 정식 출시 시 Apple 필수(4.8)** → 그때 추가. 비번 미취급(guardrail). |
| refresh 전략 | stateless refresh JWT | **DB 저장 refresh(해시) + 회전** | 로그아웃·강제 만료(revoke) 가능. 탈취 시 회전으로 무효화. |
| provider 검증 | 앱이 보낸 프로필 신뢰 | **백엔드가 카카오에 재검증** | 앱 값은 위조 가능 → 서버가 진실의 기준. |

### 4. 데이터 모델 (packages/db · 최초 마이그레이션)
```prisma
model User {
  id             String   @id @default(cuid())
  provider       AuthProvider
  providerUserId String   // provider 내 고유 id (카카오 회원번호)
  email          String?
  displayName    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([provider, providerUserId])
}
enum AuthProvider { KAKAO }   // Apple 추가 시 APPLE 값 마이그레이션
```
- MVP는 **(provider, providerUserId) 1조합 = 1 유저**. 다중 provider 연동(계정 링크)은 후속.
- entitlement(무료횟수·구독)는 별도 모델로 후속.

### 5. 모듈 구조 (backend-architecture 준수)
```
apps/api/src/modules/auth/
  auth.controller.ts     POST /auth/{kakao,refresh} · GET /auth/me
  auth.service.ts        검증 결과로 user upsert + 토큰 발급/회전
  auth.module.ts
  guards/jwt-auth.guard.ts
  decorators/current-user.decorator.ts
  ports/social-verifier.port.ts       (외부 경계 인터페이스)
  adapters/kakao.verifier.ts          Kakao /v2/user/me
  token/token.service.ts              JWT 서명·검증·refresh 회전
```
- `@nestjs/jwt` 사용. refresh 토큰은 `User`(또는 `RefreshToken` 모델)에 **해시 저장**.
- 시크릿: `JWT_ACCESS_SECRET`·`JWT_REFRESH_SECRET`·`KAKAO_*` → `.env`/Railway env.
- `SocialVerifierPort`는 Apple 재개 시 `apple.verifier.ts`만 추가하면 되도록 설계.

### 6. 위험 · 완화
- R1: 카카오 토큰 검증 누락 → 위조 로그인. **완화**: `/v2/user/me` 서버측 재검증, 실패 시 401.
- R2: refresh 토큰 탈취 → **완화**: 해시 저장 + 사용 시 회전 + 재사용 감지 시 폐기.
- R3: 시크릿 노출 → env only, 로그 금지(guardrail).
- R4: **App Store 4.8** — iOS 출시 시 Apple 로그인 없으면 리젝 → **iOS 정식 출시 전 Apple 추가**(별도 태스크)로 대비.
- R5: 실 카카오 앱 토큰 없이 로컬 검증 한계 → 검증 로직 단위테스트 + 앱 연동은 후속 태스크에서 실기기 확인.

### 7. 검증 계획
- `checks.sh`(typecheck·prisma validate) + auth 검증 로직 단위테스트(가능 시).
- 마이그레이션은 docker Postgres 필요 → `docker compose up` 후 `prisma migrate dev`.
- **정직 표기**: 실제 카카오 로그인 end-to-end는 앱 SDK + 실기기(번들 ID 반영 리빌드) 필요 → 후속 앱 태스크에서 관측.

### 8. 후속(이 태스크 밖)
- **Apple 로그인 추가** (iOS App Store 출시 전, 4.8 대응).
- 앱 로그인 화면 + Kakao SDK 연동, `분석하기` 게이트 연결.
- entitlement(무료 3회) 모델·로직, documents/pages, presign(#15).
