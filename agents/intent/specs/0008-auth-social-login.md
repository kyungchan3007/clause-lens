# 0008 — 인증(Auth): 소셜 로그인(Kakao·Apple) + JWT 세션

> **관련 태스크**: #32 · **상태**: draft
> 정책: [Notion 01. 제품 기획](https://shaded-badger-c05.notion.site/OCR-3d1deddc12a780f0bb7fc1f8403287a5) · 아키텍처: [backend-architecture.md](../../context/backend-architecture.md)
> **depends**: #14(NestJS 스캐폴드) · **unblocks**: documents/pages · uploads presign(#15) · analysis · 구독

---

## PRD (왜/무엇)

### 1. 문제
앱은 근본적으로 per-user(무료 3회·구독·저장·소유권). 서버 도메인의 토대인 **인증**이 없으면 문서·업로드·분석에 소유권을 얹을 수 없다.

### 2. 목표
- G1. **소셜 로그인(Kakao, Apple)** → 우리 **JWT 세션** 발급.
- G2. **`User` 모델**(최초 실 DB 모델·마이그레이션).
- G3. 보호 엔드포인트 접근 제어(`JwtAuthGuard` + `@CurrentUser`).
- G4. 토큰 재발급(refresh).

### 3. 비목표
- 이메일/비밀번호 로그인, 구독·결제, 비회원 임시 분석. **앱 로그인 UI/SDK 연동은 별도 태스크**(이 spec은 백엔드).

### 4. 제약 (Guardrails)
- **비밀번호 직접 취급 안 함**(소셜만). 소셜/JWT 시크릿은 **env로만**(하드코딩 금지).
- **토큰·PII·provider 원문 응답을 로그에 남기지 않음**.
- 소유권 미확인 리소스 반환 금지. 무료횟수·권한은 서버 최종 판단(이 태스크는 인증까지, entitlement 로직은 후속).

### Acceptance
- [ ] `POST /auth/kakao`(앱 access token) → provider 검증 → user upsert → `{ accessToken, refreshToken, user }`
- [ ] `POST /auth/apple`(identity token + nonce) → 애플 공개키 서명·nonce 검증 → upsert → 토큰 발급
- [ ] `POST /auth/refresh` → 회전된 새 토큰
- [ ] `GET /auth/me`(보호) → 현재 사용자, 미인증 시 401
- [ ] `User` 모델 마이그레이션 적용(docker Postgres)
- [ ] `checks.sh` PASS · 비밀값 env only · 민감정보 로그 없음

---

## SDD (어떻게)

### 1. 읽은 문서
Notion `01. 제품 기획`(로그인 정책)·`02. 사용자 기능 §9`·`05. NestJS API 설계`·`08. 인프라·배포`, repo `backend-architecture.md`·`architecture.md`.

### 2. 결정: (A) 앱 주도 + 네이티브 SDK (현업 모바일 표준)
앱이 네이티브 SDK로 소셜 로그인 → **provider 토큰** 획득 → 백엔드에 전달 → **백엔드가 검증 후 우리 JWT 발급**. 백엔드는 **stateless**(OAuth 핸드셰이크용 서버 세션/`state` 저장 불필요).

- **Kakao**: 앱 카카오 SDK → **access token** → 백엔드가 Kakao `GET /v2/user/me`로 검증·프로필 → upsert.
- **Apple**: 앱 `expo-apple-authentication` → **identity token(JWT)** + `nonce` → 백엔드가 **Apple 공개키로 서명 검증 + `nonce` 확인**(replay 방지) → upsert.
- `state`(웹 CSRF 토큰)는 리다이렉트 플로우가 아니라 **불필요**. Apple은 `nonce`로 대체.

### 3. 고려한 대안 · 트레이드오프
| 주제 | 대안 | 결정 | 근거 |
| --- | --- | --- | --- |
| OAuth 주도 | (B) 백엔드 주도 웹 OAuth(state를 Redis 저장·콜백 검증) | **(A) 앱 주도 네이티브 SDK** | 모바일 UX(원탭·네이티브 시트) 우수, 백엔드 stateless, dev build라 네이티브 모듈 가능. |
| 제공자 | 이메일/비번 · Google 추가 | **Kakao + Apple** | 한국 타깃(Kakao) + iOS 정책상 Apple 필수. 비번 미취급(guardrail). Google은 후속 확장. |
| refresh 전략 | stateless refresh JWT | **DB 저장 refresh(해시) + 회전** | 로그아웃·강제 만료(revoke) 가능. 탈취 시 회전으로 무효화. |
| provider 검증 | 앱이 보낸 프로필 신뢰 | **백엔드가 provider에 재검증** | 앱 값은 위조 가능 → 서버가 진실의 기준. |

### 4. 데이터 모델 (packages/db · 최초 마이그레이션)
```prisma
model User {
  id             String   @id @default(cuid())
  provider       AuthProvider
  providerUserId String   // provider 내 고유 id
  email          String?  // Apple은 최초 1회만/비공개 가능
  displayName    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([provider, providerUserId])
}
enum AuthProvider { KAKAO APPLE }
```
- MVP는 **(provider, providerUserId) 1조합 = 1 유저**. 다중 provider 연동(계정 링크)은 후속.
- entitlement(무료횟수·구독)는 별도 모델로 후속(#정책).

### 5. 모듈 구조 (backend-architecture 준수)
```
apps/api/src/modules/auth/
  auth.controller.ts     POST /auth/{kakao,apple,refresh} · GET /auth/me
  auth.service.ts        검증 결과로 user upsert + 토큰 발급/회전
  auth.module.ts
  guards/jwt-auth.guard.ts
  decorators/current-user.decorator.ts
  ports/social-verifier.port.ts       (외부 경계 인터페이스)
  adapters/kakao.verifier.ts          Kakao /v2/user/me
  adapters/apple.verifier.ts          Apple 공개키 JWKS + nonce
  token/token.service.ts              JWT 서명·검증·refresh 회전
```
- `@nestjs/jwt` 사용. refresh 토큰은 `User`(또는 `RefreshToken` 모델)에 **해시 저장**.
- 시크릿: `JWT_ACCESS_SECRET`·`JWT_REFRESH_SECRET`·`KAKAO_*`·`APPLE_*` → `.env`/Railway env.

### 6. 위험 · 완화
- R1: Apple identity token 검증 누락 → 위조 로그인. **완화**: JWKS 서명 + `aud`·`iss`·`nonce`·만료 검증.
- R2: refresh 토큰 탈취 → **완화**: 해시 저장 + 사용 시 회전 + 재사용 감지 시 폐기.
- R3: 시크릿 노출 → env only, 로그 금지(guardrail).
- R4: 실 provider 앱 토큰 없이 로컬 검증 한계 → 검증 로직 단위테스트 + 앱 연동은 후속 태스크에서 실기기 확인.

### 7. 검증 계획
- `checks.sh`(typecheck·prisma validate) + auth 검증 로직 단위테스트(가능 시).
- 마이그레이션은 docker Postgres 필요 → `docker compose up` 후 `prisma migrate dev`.
- **정직 표기**: 실제 카카오/애플 로그인 end-to-end는 앱 SDK + 실기기 필요 → 후속 앱 태스크에서 관측.

### 8. 후속(이 태스크 밖)
- 앱 로그인 화면 + Kakao/Apple SDK 연동, `분석하기` 게이트 연결.
- entitlement(무료 3회) 모델·로직, documents/pages, presign(#15).
