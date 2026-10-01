# 0044 — Maestro 시나리오 문구 동기화 — SDD

> **관련 PRD**: prd.md · **이슈:** #123 · **갱신**: 2026-10-02

## 0. 읽은 문서
- `app/index.tsx`(홈 분기) · `features/home/ui/{Hero,HowItWorks,BrandHeader,ProcessingScreen}.tsx` · `features/capture/ui/{CaptureCTA,PageList,PageCard,AddCell,EmptyState}.tsx` · `features/documents/ui/{RecentEntryButton,RecentListScreen}.tsx` · `features/profile/ui/ProfileScreen.tsx` · `features/result/ui/ResultScreen.tsx` · spec 0035·0038·0042

## 1. 문자열 매핑 (옛 → 현재, 근거)
| 옛 단언 | 현재 UI | 근거 |
| --- | --- | --- |
| `계약서를 담아주세요`(홈 앵커) | `계약서, 찍기만 하세요` | `features/home/ui/Hero.tsx` (온보딩·최근있음 공통) |
| `촬영하기` | `계약서 촬영` | `features/capture/ui/CaptureCTA.tsx` |
| `1페이지`(리스트 전환) | `담은 페이지 1장` | `features/capture/ui/PageList.tsx` 헤더 |
| `페이지 삭제` | `1페이지 삭제` | `PageCard.tsx` accessibilityLabel `${n}페이지 삭제` |
| `페이지 추가` | (유지) | `AddCell.tsx` accessibilityLabel |
| `업로드 완료` | `계약서를 분석하고 있어요`·`분석이 끝났어요`·`일부만 분석됐어요` 중 하나 | `ProcessingScreen.tsx` hero(업로드 확정=analysis 모드 진입) |
| `분석 완료` | `분석이 끝났어요`·`일부만 분석됐어요` | `ProcessingScreen.tsx` |
| `.*결과 보기.*` | `결과 보기`/`분석된 결과 보기` (정규식 유지) | `ProcessingScreen.tsx` |
| 홈 `최근 분석` 섹션 + `.*아직 분석한 계약서가 없어요.*` | `최근 분석 N건` 버튼(접근성 `최근 분석 N건 모두 보기`) → /recent `분석 결과는 7일 동안 보관돼요.` · 0건이면 온보딩 `HowItWorks`(촬영·분석·하이라이트) | `RecentEntryButton.tsx`·`RecentListScreen.tsx`·`HowItWorks.tsx`·`useHomeOnboarding` |
| 프로필·FAQ·로그아웃·권한 다이얼로그·`분석 결과` 헤더 | (유지) | `ProfileScreen.tsx`·`faq.ts`·`permission.ts`·`ResultScreen.tsx` |

## 2. 설계 판단
- 홈 앵커는 Hero 제목: 홈 4상태 중 "담은 페이지 없음"(온보딩·최근있음) 모두에 노출, 로딩·에러에도 Hero는 렌더 → 결정적.
- recent.yaml은 기록 유무에 따라 화면이 달라짐 → Maestro `runFlow.when.visible` 조건 분기 2개(있음: 버튼 탭 → 목록 단언 → 뒤로 / 0건: 온보딩 단언). 둘 중 하나는 반드시 실행.
- `최근 분석 N건`은 정규식 `최근 분석 \d+건.*`(텍스트·접근성 라벨 둘 다 매칭).
- upload.yaml: 업로드 모드 문구(`계약서를 올리고 있어요`)는 1장일 때 순식간 → 업로드 확정 이후 상태(analysis 모드 이상)로 대기하는 게 결정적.

### 고려한 대안
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 홈에 testID 추가 후 id로 단언 | 문구 변경에 강함 | 앱 코드 변경(N1 위반)·범위 확장 | ❌ (후속 제안) |
| Hero 제목 문구로 앵커 | 앱 변경 없음, 사용자 관점 | 문구 바뀌면 다시 깨짐 | ✅ |
| recent.yaml을 기록 있음 전제로 고정 | 단순 | seeding 없는 기본 상태에서 실패 | ❌ |

## 3. 영향받는 파일
- `apps/mobile/.maestro/*.yaml`(capture-gate 제외 전부 + capture-gate의 assertNotVisible) · `SCENARIOS.md`. 앱 코드 변경 없음.

## 5. 위험과 완화
- R1 문구 재변경 시 재부패 → 시나리오 트리거 규칙(문구 변경 PR은 `.maestro` grep) 저널·커밋 [보완]에 기록.
- R2 iOS에서 Pressable 접근성 라벨이 자식 텍스트를 가림 → 정규식 `.*` 래핑으로 둘 다 매칭.

## 7. 검증
- grep: 옛 문구가 `.maestro`에 남지 않음(`계약서를 담아주세요`는 EmptyState 전용으로만 언급).
- 시뮬 실측(로그인·무료 0회 계정): session-restore·recent·profile·faq-multi·logout-cancel·profile-back 자동 실행.
- 수동/미실측: login·login-failure(카카오 자격증명) · capture-gate·logout(세션 파괴 → 재로그인 수동) · capture-add-page·capture-remove-page·permission-denied(OS 피커/권한) · upload·analysis·result(피커 + 무료 0회 → 403).

## 검증 결과 (2026-10-02, iPhone 17 Pro 시뮬)
| 시나리오 | 결과 | 비고 |
| --- | --- | --- |
| session-restore · capture-empty · recent · profile · faq-multi · logout-cancel · profile-back | ✅ PASS | 로그인 상태 완전 자동. recent는 기록 6건 → "최근 분석 \d+건" 분기 실행 |
| capture-add-page · capture-remove-page | ✅ PASS | OS 사진 피커 사진 탭만 수동(시뮬 좌표 탭) |
| capture-gate | ✅ PASS | 세션 만료 후 clearState 실행 |
| upload | ⚠️ 미실측 | 실행 중 access 만료 → "분석에 문제가 생겼어요 / 로그인이 필요해요." (앱에 refresh 자동화 없음, TTL 15분). yaml 결함 아님 |
| analysis · result | ⚠️ 미실측 | 세션 만료 + 무료 0회(403) |
| login · login-failure | 수동 | 카카오 자격증명 |
| logout · permission-denied | 미실행 | 세션 파괴 / OS 권한 거부 수동 |
- grep: `.maestro`에 옛 문구 잔존 없음(`계약서를 담아주세요`는 설명 주석·SCENARIOS Note에만).
- 게이트 `checks.sh` **ALL PASS**.
