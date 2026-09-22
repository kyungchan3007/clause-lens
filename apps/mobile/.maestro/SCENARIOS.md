# E2E 테스트 시나리오 (ClauseLens 모바일)

> 현재까지 구현된 기능(#12 촬영·#36 로그인·#38 프로필)의 end-to-end 시나리오.
> 형식: **Given / When / Then**. 실행형 플로우는 같은 폴더의 Maestro `*.yaml`.
> appId: `com.chan.clauselens`

## 실행 방법 (Maestro)
```bash
# 설치(최초 1회)
curl -Ls "https://get.maestro.mobile.dev" | bash
# 로컬 백엔드 + docker(Postgres) 기동 필요 (로그인/세션 시나리오)
#   docker compose up -d && (cd apps/api && pnpm dev)
# dev build 앱이 시뮬레이터에 설치되어 있어야 함 (expo run:ios)
maestro test apps/mobile/.maestro/          # 전체
maestro test apps/mobile/.maestro/profile.yaml   # 개별
```

> ⚠️ **카카오 로그인은 계정 자격증명 입력이 필요**해 완전 자동화 불가. 로그인 웹뷰까지 자동 진행 후 **자격증명은 수동**(테스트 계정). 로그인 이후(프로필·FAQ·로그아웃)는 자동.

---

## S1. 미인증 게이트 (capture-gate)
- **Given** 저장된 세션이 없다(로그아웃 상태)
- **When** 앱을 실행한다
- **Then** 로그인 화면이 보인다: 타이틀 "ClauseLens", 버튼 "카카오로 시작하기"
- **And** Capture(촬영하기) 화면으로 진입하지 않는다

## S2. 카카오 로그인 (login) — 일부 수동
- **Given** 로그인 화면 · 로컬 백엔드 기동
- **When** "카카오로 시작하기"를 탭한다
- **Then** 카카오 로그인 웹뷰(kauth.kakao.com)가 열린다
- **When** (수동) 카카오 계정으로 로그인/동의("계속하기")
- **Then** 백엔드 `/auth/kakao` 교환 성공 → JWT가 SecureStore에 저장
- **And** Capture 화면("계약서를 담아주세요")으로 진입한다
- **And** (백엔드 확인) `User`·`RefreshToken` 1행 생성, displayName은 실제 카카오 프로필

## S3. 세션 복원 (session-restore)
- **Given** 로그인된 상태(SecureStore에 세션 존재)
- **When** 앱을 종료 후 다시 실행한다
- **Then** 로그인 화면을 거치지 않고 **Capture로 바로 진입**한다(`/auth/me` 서버 검증 통과)
- **Edge** access가 만료/무효면 로그인 화면으로(토큰 문자열 존재만으로 인증하지 않음)

## S4. 프로필 진입 · 내 정보 (profile)
- **Given** 로그인된 상태, Capture 화면
- **When** 헤더의 프로필 아이콘(접근성 라벨 "마이페이지")을 탭한다
- **Then** "마이페이지" 화면이 열린다(네이티브 헤더 + 뒤로)
- **And** 내 정보에 닉네임(실 프로필)과 "카카오 계정으로 로그인"이 표시된다

## S5. FAQ 아코디언 (profile)
- **Given** 마이페이지
- **When** "자주 묻는 질문"의 한 항목(예: "ClauseLens는 무엇을 해주나요?")을 탭한다
- **Then** 해당 답변이 펼쳐진다
- **When** 같은 항목을 다시 탭한다
- **Then** 답변이 접힌다

## S6. 1:1 문의 준비 중 (profile)
- **Given** 마이페이지
- **When** "1:1 문의"를 탭한다
- **Then** "준비 중" 안내 다이얼로그가 뜬다("곧 제공될 예정")

## S7. 로그아웃 (logout)
- **Given** 마이페이지
- **When** "계정 > 로그아웃"을 탭한다
- **Then** 확인 다이얼로그("로그아웃 하시겠어요?")가 뜬다
- **When** "로그아웃"을 확인한다
- **Then** 세션이 삭제되고 로그인 화면으로 돌아간다
- **And** (백엔드 확인) 해당 세션의 `RefreshToken`이 폐기된다

## S8. 촬영/갤러리 (capture) — 참고(#12)
- **Given** 로그인된 상태, Capture 화면
- **When** "촬영하기"/"갤러리에서 선택"을 탭한다
- **Then** OS 카메라/사진 권한·피커가 뜬다(권한·피커 자체는 OS 영역, 스모크 수준)

## S16. 로그인 실패 — 친화 문구 노출 (login-failure) — 반자동
- **Given** 로그인 화면 · **백엔드(/auth/kakao)가 응답하지 않음**(docker/api off)
- **When** "카카오로 시작하기" → (수동) 카카오 인증까지 완료
- **Then** 토큰 교환이 실패하고 **친화 문구**가 뜬다("네트워크 연결을 확인해주세요") — 원문(`Network request failed` 등) 미노출
- **And** Capture로 진입하지 않고 로그인 화면에 남아 재시도할 수 있다
- **Edge** 사용자가 카카오 로그인을 **취소**하면 에러 문구를 띄우지 않는다(조용히 로그인 화면 유지)
- **Note** 매핑 로직 4케이스는 단위 테스트(`lib/loginError.test.ts`)로 커버 — yaml은 화면 노출만 확인

---

## 백엔드 계약 검증(단위/통합에서 커버)
로그인/회전/로그아웃/가드의 로직은 `apps/api` 단위 테스트(`*.spec.ts`)로,
앱 상태 전이(restore/setSession/signOut)·저장·API는 `apps/mobile` 단위 테스트(`*.test.ts`)로 커버.
이 문서의 S1~S8은 **화면 흐름 통합 관점**의 시나리오.
