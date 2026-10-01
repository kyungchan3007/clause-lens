# 0039 — 구독 예고 UI — SDD

> **관련 PRD**: prd.md · **이슈:** #114 · **갱신**: 2026-10-01

## 1. 접근 (Approach)

### 1-1. 403 식별 (analysis)
- `analysisStore`에 `errorKind?: "quota"` 추가(reset이 비움).
- `useAnalysis` requestAnalysis catch: `e.status===403` → `set({ phase:"error", message, errorKind:"quota" })`. 그 외 error는 errorKind 미설정.

### 1-2. app/index 분기
- `analysisErrorKind = useAnalysisStore(s=>s.errorKind)` 구독. `merged()` 분석 error 반환에 `errorKind` 포함.
- 렌더: `hasPages && m.phase==="error" && m.errorKind==="quota"` → **QuotaExceededScreen**(아래). 그 외 비idle → 기존 ProcessingScreen.
- `onConfirm = onCancel`(분석 error 닫고 idle 복귀, 담은 페이지 유지). `onViewStatus = () => router.push("/recent")`.

### 1-3. QuotaExceededScreen (entitlement/ui 신규, 표시 전용)
- 센터: 티켓 아이콘(앰버) — `bg-warning-bg` 박스 + `Icon name="Ticket" color=warning`. "무료 분석 횟수가 없어요"(h1) + 부제.
- Notice(info, `icon="Star"`): "곧 **구독**으로 무제한 분석을 제공할 예정이에요." (굵게는 일반 텍스트로 — Notice는 plain).
- 하단: Button "확인"(primary, onConfirm) + "남은 분석 상태 보기" Pressable(onViewStatus).
- props: `{ onConfirm, onViewStatus }`.

### 1-4. SubscriptionPromoCard (documents/ui 신규) — ⑨
- primary-tint 카드: `Icon ShieldCheck`(primary) + "분석 결과를 계속 보관하세요"(semibold) + 부제(muted) + Button "구독 알아보기 (곧 제공)"(primary, fullWidth).
- 버튼 onPress → `Alert`("구독 기능은 곧 제공될 예정이에요.") (구독 미구현 — 안내만). RecentListScreen 하단 **FlatList 밖 고정**(스크롤과 분리).
- 0건·로딩·에러 때는 숨김(목록 있을 때만). 

### 1-5. 아이콘
- `Star`를 ICON_REGISTRY에 추가(Notice용). Ticket·ShieldCheck는 기존.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 403을 ProcessingScreen error 안에서 분기 | 파일 적음 | 시안이 전혀 다른 레이아웃(티켓·확인·상태보기) | ❌ → 전용 화면 |
| 403 식별을 메시지 문자열로 | 저장 변경 없음 | 취약(문구 변경 시 깨짐) | ❌ → errorKind |
| 구독 버튼 네비게이션(플랜 화면) | 완결 | TASK-006 미구현 | ❌ → Alert 안내 |
| 구독 카드를 FlatList ListFooter로 | 간단 | 스크롤 끝에서만 보임(시안=하단 고정) | ❌ → FlatList 밖 고정 |

## 3. 검증 (Verification)
- **단위**: QuotaExceededScreen(제목·부제·구독 Notice·확인/상태보기 버튼·콜백) · SubscriptionPromoCard(제목·버튼·Alert) · analysisStore(errorKind set/reset) · (app 분기는 통합).
- **게이트**: `checks.sh` PASS.
- **시뮬레이터**: 무료 0회에서 분석하기 → 403 → 무료 소진 화면(티켓·확인·상태보기). /recent 하단 구독 카드·버튼.
- 로그인 상태 활용(이번 세션, 무료 0회).
