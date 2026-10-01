# 0036 — 분석 진행 화면 리디자인 (순서2) — SDD

> **관련 PRD**: prd.md · **이슈:** #108 · **갱신**: 2026-10-01

## 1. 접근 (Approach)

### 1-0. 서버 계약(코드 확인 — 설계 토대)
- **업로드**(`features/upload/model/useUpload.ts`): expo-file-system **FOREGROUND** PUT. 앱 닫으면 중단. `cancel()`=진행 PUT 실제 중단(`activeTask.cancelAsync()`)+runId bump. → 버튼 "취소"=진짜. "앱 닫아도 계속"=**거짓**.
- **분석**(`features/analysis/model/useAnalysis.ts`): `requestAnalysis`가 서버 job 접수(jobId·stateVersion) → 클라는 SSE+폴링으로 **관찰만**. 서버 독립 실행, documentId로 재관찰. `cancel()`=관찰 teardown+reset뿐, **서버 취소 아님**(취소 엔드포인트 없음). → "앱 닫아도 계속"=**참**, 버튼 "분석 취소"=거짓 약속 → **"나가기"**.
- 늦은 응답/계정전환: 두 스토어 모두 `alive(runId)` 가드 + `applyStatus` stateVersion 역순 방지 → **기존 코드가 방어**(신규 불필요).

### 1-1. 홈 전용(apps/mobile/src/features/home/ui, 신규)
- **ProcessingScreen**(신규, presentational): merged analyze props(`phase·sentCount·totalCount·message·onCancel·onRetry·onViewResult`)만 수신. BrandHeader는 app이 이미 위에 렌더 → 화면은 body만.
  - 모드 판정(phase→mode): 업로드(presigning·uploading·confirming) / 분석(requesting·analyzing) / done / partial / failed·error.
  - 센터 히어로: 문서+스캔 그래픽(DocScanGraphic) + h1(모드별) + sub + "계약서 N페이지"(totalCount 가시화).
    - 업로드 h1 "계약서를 올리고 있어요", 분석 h1 "계약서를 분석하고 있어요"/sub "불리할 수 있는 조항을 찾는 중…".
  - 진행 블록:
    - determinate(uploading=전송 N/N, analyzing=완료 M/N & totalCount>0): 좌 라벨·우 "M / N페이지" + 진행바(bg-border/bg-primary) + **주정보 텍스트**("N페이지 중 M페이지 분석 완료"). 큰 % 없음.
    - indeterminate(presigning·confirming·requesting): **스피너 1개 + 단계텍스트**("업로드 준비 중…"·"서버 확인 중…"·"분석 요청 중…"). 가짜 바/now=0 금지.
  - 안심 Notice(분석 구간만, tone 성공/초록 + shield): "서버에서 분석 중이에요. 앱을 닫아도 분석은 계속돼요."
    - 업로드 구간: tone neutral 안내 "전송이 끝날 때까지 앱을 열어 두세요."
  - 하단 액션(모드별):
    - 업로드 → **"취소"**(secondary, onCancel=실제 중단).
    - 분석 → **"나가기"**(secondary, onCancel=관찰 중단·서버 계속).
    - done → **"결과 보기"**(primary, onViewResult).
    - partial → "일부 페이지 분석에 실패했어요" 명시 + **"분석된 결과 보기"**(primary, onViewResult).
    - failed·error → 에러 아이콘(danger)+message + **"다시 시도"**(primary, onRetry) + **"페이지 확인"**(ghost/secondary, onCancel→idle 복귀).
- **DocScanGraphic**(신규, home 내부): 문서 박스+스캔 라인. 모션은 분석 구간에서만, `AccessibilityInfo.isReduceMotionEnabled` 시 정적. 단일 사용처 → 공용 승격 안 함(0012).

### 1-2. 공용(packages/ui) — 재사용·최소 신설
- **Notice** `tone` 확장 필요 시 "success" 허용(현재 info/neutral). shield 아이콘은 icon prop로.
- **진행바·스피너**: 진행바는 인라인(Tailwind) 재사용(신규 공용 보류 — 단일 패턴). 스피너는 RN `ActivityIndicator`(color=primary).
- Button/Notice/Icon 기존 사용. 신규 공용 컴포넌트는 만들지 않음(재사용 생기면 승격).

### 1-3. capture — PageList 축소
- **PageList**: 진행·터미널 분기(상태 라벨·진행바·취소/다시시도/결과보기) **제거** → **idle 전용**(담은 페이지 목록 + 하단 "분석하기" + quota 슬롯). `AnalyzeControls`는 유지하되 PageList는 `onAnalyze`·quota만 사용.
- quota 슬롯·"완료 시 1회 차감"은 idle에서만(현재와 동일).

### 1-4. 홈 조립(app/index.tsx)
- 분기: `hasPages && phase==='idle'` → CaptureScreen(PageList) / `hasPages && phase!=='idle'` → ProcessingScreen / `!hasPages` → 기존 온보딩·최근(순서1 불변).
- ProcessingScreen에 merged props + onCancel/onRetry/onViewResult 기존 핸들러 그대로 주입(라벨은 ProcessingScreen이 모드로 결정).
- `active`·자동 시작 ref·계정전환 무효화·draft 잠금(setLocked) **불변**. (잠금은 active에서만; 터미널에선 해제 → 페이지 수정 가능.)

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 인라인 진행바 강화(전용 화면 X) | 페이지 목록 계속 보임·최소 변경 | 시안 불일치·히어로 부재 | ❌ → 전용 화면(목록은 N페이지 카운트로 대체) |
| active만 전용 화면, 터미널은 PageList | 분리 단순 | 완료 순간 구조 급변·터미널 UI 소실 | ❌ → 터미널까지 전용 화면 |
| 시안 "분석 취소"·68%·초록 Notice 유지 | 시안 충실 | 서버 취소 불가(거짓)·시간≠페이지·업로드 중 거짓 | ❌ → 정직 3곳 수정(사용자 승인) |
| ProcessingScreen 공용(ui) 승격 | 재사용 | 단일 사용처(0012 위반) | ❌ → 홈 전용 |
| 진행바·스피너 공용 신설 | 일관 | 단일 패턴·과설계 | ❌ → 인라인·ActivityIndicator |
| 지금 "백그라운드로"·읽기전용 목록 | UX 향상 | 스코프 과대·documentId 보존 설계 | ❌ → 후속 |

## 3. 검증 (Verification)
- **단위**(jest.ui 아님 — 모바일 feature): ProcessingScreen 모드 분기 — 업로드/분석 h1·버튼 라벨("취소" vs "나가기")·determinate 주정보·indeterminate 스피너·done/partial/error 액션·분석만 초록 Notice. phase별 렌더 스냅/쿼리(react-test-renderer, accessibilityRole 쿼리 `.some`).
- **동작 보존 단위**: onCancel/onRetry/onViewResult가 모드별로 올바른 콜백에 연결(업로드 취소 vs 분석 나가기 둘 다 onCancel이나, app 레이어 분기는 기존 테스트/로직).
- **시뮬레이터 실측**: 담은 페이지 → 분석하기 → (업로드/분석 진행 화면) → 완료/취소/나가기·재시도. reduced-motion 토글 시 스캔라인 정지. 큰 글자·44pt.
- **게이트**: `bash agents/harness/evals/checks.sh` PASS(typecheck+expo-doctor+ui).
- 로그인 이후 실측(세션 만료 시)·Android 그림자 없음(이 화면 shadow 미사용)·경과시간 문구는 후속.
