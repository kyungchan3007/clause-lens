# 0061 — 결과 격리 세션 하드닝 (TRACE · 판단 로그)

- **이슈:** #76

## 2026-10-02

### 착수 · 사전 조사
- 게이트 위치: `widgets/result-source`. `isLiveResult`가 가시성+이미지를 한 술어로 묶고, 교차 사용자 격리의 유일 방어가 `userId===uploadOwner`.
- `analysisStore`: ownerUserId 없음. `uploadStore`: ownerUserId 있음(업로드 시작 스탬프).
- `GetAnalysisAuth`는 이미 `{accessToken, userId}` 반환 → analysisOwner 스탬프 소스 확보됨.
- 리셋 배선 지점: `app/_layout.tsx`가 `useDocumentsSync`·`useEntitlementSync` 마운트. `useAccountResourceSync`는 account-scoped(문서·잔량) 전용(syncAccount/refresh).
- 선행: #126 머지됨(onAuthLost가 status→unauthenticated). 리셋 훅이 userId 변화로 그 경로도 커버.

### 설계 토론 결과(Codex, gpt-6-astra) — 채택
- **① 스탬프**: useAnalysis.start에서 getAuth userId를 bumpRunWith/set에 기록. store·lib는 auth 무지(결합은 start에만). 소유자 없으면 가시성 차단.
- **② 게이트**: 순수 lib `canUseAnalysisSnapshot`(가시성=분석소유)·`canUseUploadImages`(이미지=업로드소유) 분리, useResultSource 조합(순서 고정: 가시성 통과 시에만 이미지 검사, 실패 시 {} 목록-only). isLiveResult 개명.
- **③ 리셋**: 계정 전이(A→B·A→null·onAuthLost=null) 감시. Codex는 useAccountResourceSync 확장 권장.
- **④ 보장**: 스탬프=가시성 경계(매 판정·리셋 대기 없음), 리셋=민감 메모리 제거+run 무효화. 둘 다 필요. 핵심 테스트: **업로드 소유자만 현재 사용자여도 이전 분석 차단.**

### 내 확정(= Codex 핵심 채택 + 변형 1)
- ①②④ 그대로 채택.
- **③ 리셋은 전용 훅 `useResultSessionReset`로** (Codex의 useAccountResourceSync 확장에서 변형). 이유: useAccountResourceSync는 `{syncAccount, refresh}`를 요구하는 account-scoped 리소스 전용 → analysis·upload(그 계약 없음)를 넣으면 추상화 오염. 노출 차단은 스탬프가 책임지므로 리셋은 동일 auth 신호를 보는 전용 훅이 명확(실질 중복 effect 1개). sdd 대안표에 기록.

### 구현 기록
- `analysisStore`: `ownerUserId?` 추가 + reset()이 지움.
- `useAnalysis.start`: getAuth userId 확인 직후 `set({ ownerUserId: auth.userId })` 스탬프(인증 신원 동일 시점, 공백은 가시성 차단).
- `widgets/result-source/lib`: `isLiveResult` → `canUseAnalysisSnapshot`(가시성=분석소유)·`canUseUploadImages`(이미지=업로드소유) 2개 순수 술어. index export 갱신.
- `useResultSource`: 가시성 실패→review / 통과→live + imageByPageId = canUseUploadImages ? allImages : {}(목록-only).
- `shared/model/useResultSessionReset`(신규) + `app/_layout.tsx` 마운트: userId 전이(A→B·A→null·onAuthLost) 시 analysis·upload reset(최초 마운트 제외).
- 테스트: resultSource(가시성·이미지 조건표 + **업로드 소유자만 일치해도 이전 분석 차단**), useResultSource(목록-only·격리·참조유지), useResultSessionReset(전이 3경로·동일계정 무리셋), useAnalysis(owner 스탬프). mobile 36 PASS·checks.sh ALL PASS.
- 격리 2중 방어 확인: 스탬프(가시성, 매 판정)=즉시 차단, 리셋(위생)=메모리 제거. 둘 다.
