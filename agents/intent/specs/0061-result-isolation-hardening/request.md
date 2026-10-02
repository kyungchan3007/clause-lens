<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #76

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/76
- 캡처: 2026-10-02

---
## 요약

결과 화면 격리를 세션 하드닝하여, 업로드 스냅샷 부재 시 **목록-only 우아한 저하**를 교차 사용자 누출 없이 안전하게 활성화. PR #75 리뷰([P1](https://github.com/kyungchan3007/clause-lens/pull/75#discussion_r4142927445)) 후속.

## 문제 / 배경

- 현재 `analysisStore`에 소유자 필드 없음. 로그아웃이 `analysisStore`·`uploadStore`를 리셋하지 않음(메모리 잔존).
- 그 결과 `app/result.tsx`의 `uploadDocId===requestedDocId` + `userId===uploadOwner` 게이트가 **교차 사용자 분석 결과 격리의 유일한 방어**. load-bearing 상태.
- 이 게이트를 완화하면 이전 계정의 분석 결과가 새 계정에 노출 가능(문서 id만 알면 back-stack 등으로 진입). 따라서 PR #75에서는 완화 거절, 게이트 유지.
- 부작용: 업로드 스냅샷이 다른 문서일 때(같은 사용자, 새 문서 진행 후 이전 결과 열람) 전체 진입 차단 → "목록-only" 저하 불가.

## 제안하는 변경

- `analysisStore`에 `ownerUserId` 스탬프 추가(분석 시작 시점 소유자 기록).
- 로그아웃·계정 변경 시 `analysisStore`·`uploadStore` 리셋(세션 경계 정리).
- 위 두 신호 확보 후 `app/result.tsx` 게이트 분리:
  - **결과 가시성**: `analysisDocId===requestedDocId` + `userId===analysisOwner` + `pages.length>0`.
  - **이미지(오버레이)**: `uploadDocId===requestedDocId` + `userId===uploadOwner`일 때만 `imageByPageId` 주입, 아니면 빈 맵 → `ResultScreen`이 목록-only로 저하.
- 세션 하드닝 항목(기존 백로그): 리프레시 토큰 회전·재로그인 시 이전 세션 토큰 폐기와 함께 묶어 검토 가능.

## 완료 조건

- [ ] `analysisStore.ownerUserId` 추가·분석 시작 시 스탬프
- [ ] 로그아웃/계정 변경 시 `analysisStore`·`uploadStore` 리셋
- [ ] 결과 진입 게이트 = 분석 소유·문서 일치 기준으로 분리, 이미지 게이트는 업로드 스냅샷 문서 일치로 분리
- [ ] 업로드 스냅샷 불일치·부재 시 목록-only 저하(오버레이 미사용) 동작
- [ ] 계정 변경 후 이전 계정 분석 결과 미노출(단위 테스트로 격리 검증)
- [ ] `bash agents/harness/evals/checks.sh` PASS + 단위(격리 케이스) 추가

## 관련

- PR #75 리뷰 스레드(결과 진입 게이트) · spec `0022-app-result-highlight` Acceptance 55·57
- 재진입 영속(서버 이미지 다운로드)은 TASK-006 별개
- 우선순위: 공개 전 처리 권장(프라이버시). 4b(#73) 자체는 현재 게이트로 안전하므로 이 이슈는 후속.

## 커밋메시지(한글)

`refactor: 결과 격리 세션 하드닝 — analysisStore 소유자 스탬프 + 로그아웃 스토어 리셋`
