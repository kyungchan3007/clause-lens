# 0061 — 결과 격리 세션 하드닝 (PRD)

- **상태**: draft
- **작성**: Claude  ·  **날짜**: 2026-10-02
- **이슈:** #76

## 1. 문제 (Problem)
결과 화면의 교차 사용자 격리가 **업로드 스냅샷 소유자 하나에만** 의존한다(load-bearing).
- `widgets/result-source`의 `isLiveResult`는 live(메모리 스냅샷+이미지) 판정에 `analysisDocId===req && uploadDocId===req && userId===uploadOwner && pageCount>0`을 **모두** 요구.
- `analysisStore`엔 소유자(ownerUserId) 필드가 **없다**. 로그아웃/계정 변경 시 `analysisStore`·`uploadStore`가 **리셋되지 않아** 메모리에 잔존.
- 부작용: 같은 사용자라도 업로드 스냅샷이 다른 문서일 때(새 문서 진행 후 이전 결과 열람) live 전체가 막혀 **목록-only 우아한 저하가 불가**.
- 위험: 격리의 유일 방어가 업로드 소유자라, 분석 결과 가시성 자체가 분석 소유자 기준이 아니다(PR #75 리뷰 P1 후속).

## 2. 목표 (Goals)
- G1. `analysisStore.ownerUserId` 추가 — 분석 시작 시점의 인증 사용자로 스탬프.
- G2. 결과 가시성 게이트를 **분석 소유·문서 일치** 기준으로, 이미지 오버레이 게이트를 **업로드 스냅샷 소유·문서 일치** 기준으로 분리.
- G3. 업로드 스냅샷 불일치·부재 시 **목록-only 저하**(오버레이 미사용).
- G4. 로그아웃·계정 변경 시 `analysisStore`·`uploadStore` 리셋(세션 경계 메모리 정리).
- G5. 계정 변경 후 이전 계정 분석 결과 미노출(단위 테스트로 격리 검증).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 재진입 영속(서버 이미지 다운로드) — TASK-006 별개.
- N2. 같은 사용자 재로그인 시 이전 세션 결과 차단(계정 ID 외 세션 generation 필요) — 교차 사용자 누출이 아니므로 범위 밖(후속 검토).
- N3. 리프레시 토큰 회전·세션 하드닝 토큰 측면(#126에서 처리).

## 4. 사용자 흐름 (User Flow)
- 방금 분석(현 계정·같은 문서) → 결과 가시 + 업로드 스냅샷 있으면 이미지 하이라이트, 없으면 목록-only.
- 계정 변경/로그아웃 → 이전 분석·업로드 메모리 리셋 + 가시성 게이트가 소유자 불일치로 즉시 차단.

## 5. 성공 지표 (Success Metrics)
- 순수 게이트 단위 테스트: 분석 소유자 불일치·미인증·문서 불일치·빈 pages → 차단 / 분석만 일치 → 목록-only / 분석·업로드 모두 일치 → 이미지. **업로드 소유자만 현재 사용자여도 이전 분석은 차단.**
- 리셋 훅 테스트: 로그아웃·계정 변경 → analysis·upload reset 호출 / 동일 계정 유지 → 불필요 리셋 없음.
- `bash agents/harness/evals/checks.sh` ALL PASS.

## 6. 제약 (Constraints)
- 앱(apps/mobile)만. 서버 계약 불변.
- FSD: 순수 판정은 `widgets/result-source/lib`(React·auth 비의존), 조합은 훅.
- 설계 확정은 **Codex 설계 토론 후**(메모리 규칙) — 근거 sdd.

## 7. 미해결 질문 (Open Questions) — Codex 토론에서 확정
- Q1. analysisOwner 스탬프 위치·소스(getAuth userId). → 확정.
- Q2. 게이트 분리 형태(두 순수 술어 + 훅 조합). → 확정.
- Q3. 리셋 배선 위치(계정 전이 감시). → 확정.
- Q4. 스탬프 vs 리셋 역할·중복 여부. → 둘 다 필요(가시성 경계 vs 메모리 위생).

### Acceptance
- [x] Codex 설계 토론으로 범위·방식 확정, 근거를 sdd에 기록
- [x] `analysisStore.ownerUserId` 추가·분석 시작 시 스탬프 (useAnalysis.start)
- [x] 로그아웃/계정 변경 시 `analysisStore`·`uploadStore` 리셋 (useResultSessionReset, _layout 마운트)
- [x] 결과 진입 게이트 = 분석 소유·문서 일치 / 이미지 게이트 = 업로드 스냅샷 소유·문서 일치로 분리 (canUseAnalysisSnapshot·canUseUploadImages)
- [x] 업로드 스냅샷 불일치·부재 시 목록-only 저하 동작 (imageByPageId={})
- [x] 계정 변경 후 이전 계정 분석 결과 미노출(단위 테스트로 격리 검증 — 업로드 소유자만 일치해도 차단 포함)
- [x] `bash agents/harness/evals/checks.sh` PASS + 단위(격리 케이스) 추가
