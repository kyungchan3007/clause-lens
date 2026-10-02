# 0061 — 결과 격리 세션 하드닝 (SDD)

- **관련 PRD**: 0061-result-isolation-hardening/prd.md
- **이슈:** #76
- **상태**: draft
- **설계 토론**: Codex(gpt-6-astra) 2026-10-02 — 결정 근거는 trace.md "설계 토론 결과" 참조.

## 1. 접근 (Approach)
격리를 **두 축으로 분리**한다: (가시성) 분석 소유자, (이미지) 업로드 소유자. 가시성은 **스탬프 불일치로 매 판정에서 즉시 차단**(렌더 전), 리셋은 **세션 경계에서 민감 메모리 제거**(effect). 둘은 역할이 달라 모두 필요.

**① analysisOwner 스탬프** (`features/analysis`)
- `analysisStore`에 `ownerUserId?: string` 추가. `reset()`이 함께 `undefined`로 지움.
- `useAnalysis.start`: `getAuth()`가 이미 `{accessToken, userId}` 반환 → 인증·isAlive 확인 직후 `set({ ownerUserId: auth.userId })`로 스탬프(인증 신원과 동일 시점). analysisStore·순수 lib는 auth를 모른다(결합은 start orchestration에만).
- 스탬프 공백(요청 중, 아직 owner 미설정) 동안은 `userId===owner`가 거짓 → 가시성 차단(안전).

**② 게이트 분리(순수 lib)** (`widgets/result-source/lib/resultSource.ts`)
- `isLiveResult` 제거 → 두 순수 술어:
  - `canUseAnalysisSnapshot(s)` = `!!requestedDocId && !!userId && analysisDocId===requestedDocId && userId===analysisOwner && pageCount>0` (null===null 통과 금지).
  - `canUseUploadImages(s)` = `!!requestedDocId && !!userId && uploadDocId===requestedDocId && userId===uploadOwner`.
- `useResultSource` 조합(순서 고정): 가시성 실패 → `review`. 가시성 통과 → `live` + `imageByPageId = canUseUploadImages ? toImageByPageId(uploadPages) : {}`(빈 맵이면 ResultScreen 목록-only).

**③ 세션 리셋 배선** (`app/_layout.tsx` + 작은 훅)
- 신규 훅 `useResultSessionReset()` — 인증 `userId`(및 로그아웃=null) 변화를 감시해 `analysisStore.reset()` + `uploadStore.reset()` 호출. `_layout`에 마운트(이미 `useDocumentsSync`·`useEntitlementSync`가 있는 곳).
- 세 전이 커버: A→B(계정 변경)·A→null(로그아웃)·onAuthLost(#126, status→unauthenticated=userId null) 모두 userId 변화로 감지.

**④ 격리 보장**
- 즉시: 가시성 술어가 `userId===analysisOwner`로 매 판정 차단(리셋 완료 대기 없음).
- 위생: 리셋이 메모리 제거 + 진행 중 run 무효화(reset이 이후 bumpRunWith로 세대 증가, 늦은 콜백은 isAlive로 폐기 — 기존 runGuard).

## 2. 고려한 대안 (Alternatives)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 스탬프 소스 | authStore를 analysisStore/lib가 직접 read | ❌ | FSD 결합·테스트 어려움 |
| | **getAuth userId를 start에서 스탬프** | ✅ | 인증 경계 1곳, store/lib는 auth 무지(Codex) |
| 게이트 | isLiveResult 하나 유지 | ❌ | 가시성이 업로드 소유자에 묶여 목록-only 불가 |
| | **canUseAnalysisSnapshot + canUseUploadImages 분리** | ✅ | 가시성=분석소유, 이미지=업로드소유(Codex a+b) |
| 리셋 배치 | useAccountResourceSync 확장(Codex 권장 a) | ❌(변형) | analysis·upload는 syncAccount/refresh 없는 비(非)account-resource라 그 계약을 오염 |
| | **전용 훅 useResultSessionReset(동일 auth 신호 감시)** | ✅ | 계약 분리·명확. 중복은 useEffect 1개뿐, 노출 방어는 스탬프가 담당(리셋은 위생) |
| 보장 | 스탬프만 / 리셋만 | ❌ | 스탬프=가시성 경계, 리셋=메모리 제거·run 무효화 — 역할 다름 |
| | **둘 다** | ✅ | Codex |

> Codex는 리셋을 useAccountResourceSync에 넣기를 권했으나, 그 훅은 `{syncAccount, refresh}`를 요구하는 account-scoped 리소스(문서·잔량) 전용이다. analysis·upload는 그 계약이 없어 넣으면 추상화가 깨진다. 노출 차단은 스탬프(렌더 전 매 판정)가 책임지므로, 리셋은 동일 auth 신호를 보는 **전용 훅**으로 두는 편이 명확하다(실질 중복=effect 1개).

## 3. 영향받는 코드 (Touched Surface)
- `features/analysis/model/analysisStore.ts`(ownerUserId·reset), `features/analysis/model/useAnalysis.ts`(스탬프).
- `widgets/result-source/lib/resultSource.ts`(술어 2개), `widgets/result-source/model/useResultSource.ts`(조합), `widgets/result-source/index.ts`(export).
- 신규 `shared/model/useResultSessionReset.ts`(+테스트), `app/_layout.tsx`(마운트).
- 테스트: resultSource.test, analysisStore.test, useResultSource.test, useResultSessionReset.test.
- 앱 전용. 서버 계약·ResultScreen(빈 imageByPageId=목록-only) 불변.

## 4. 데이터 / 계약 (Contracts)
- analysisStore에 `ownerUserId?: string` 추가(기존 소비자 영향 없음, optional).
- resultSource public API: `isLiveResult` → `canUseAnalysisSnapshot`·`canUseUploadImages`로 교체(내부 위젯 전용, 외부 소비 없음 확인).

## 5. 위험과 완화 (Risks)
- R1 스탬프 공백(요청 중) 노출 → 완화: owner 미설정이면 `userId===owner` 거짓 → 차단.
- R2 effect 리셋이 렌더보다 늦음 → 완화: 노출 차단은 스탬프(매 판정), 리셋은 위생 전용(Codex).
- R3 늦은 분석/업로드 응답이 리셋 후 store 복원 → 완화: runGuard isAlive로 stale 쓰기 폐기(reset→다음 start의 bumpRunWith가 세대 증가).
- R4 같은 사용자 재로그인 시 이전 결과 노출 → 범위 밖(교차 사용자 아님), 후속(세션 generation) 필요 — prd N2.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
- 앱 변경만. 되돌리려면 술어 분리·ownerUserId·리셋 훅을 revert(위젯 내부라 외부 영향 없음).

## 7. 검증 (Verification)
- 단위:
  - resultSource: 조건표(소유자 불일치·미인증·문서 불일치·빈 pages→차단 / 분석만 일치→목록-only / 둘 다→이미지 / **업로드 소유자만 일치해도 이전 분석 차단**).
  - analysisStore: start 스탬프·reset이 ownerUserId 지움.
  - useResultSessionReset: A→B·A→null·onAuthLost 리셋 호출 / 동일 userId 무(無)리셋.
- 통합: `bash agents/harness/evals/checks.sh` ALL PASS(mobile typecheck+jest 포함).
