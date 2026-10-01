# 0036 — 분석 진행 화면 리디자인 (UI/UX 순서2) — PRD

> **이슈:** #108 · **상태**: in-progress · **유형**: UI/UX (화면 리디자인) · **갱신**: 2026-10-01

## 1. 문제
순서1(홈) 완료. 업로드~분석이 "진행 중"일 때 홈은 현재 **PageList 하단 인라인 진행바**(상태 라벨+바+버튼)로만 표현한다. 확정 시안(14 페이지 ③ Analyzing)은 **전용 진행 화면**(센터 히어로·진행 블록·안심 Notice·취소)이다. 착수 전 Codex 적대 설계 토론 + 서버 계약 코드 확인으로 수렴.

## 2. 목표
- G1. **전용 ProcessingScreen**: `idle` 외(= active + 모든 터미널 done/partial/failed/error)일 때 홈 body를 전용 화면으로. idle만 PageList(페이지 리뷰+분석하기). (active만 쓰면 완료 순간 터미널 UI가 사라지는 모순 → 터미널까지 같은 화면 유지.)
- G2. **모드별 상태**(시안 레이아웃 유지): 업로드 중 / 분석 중 / done / partial / failed·error. 카운트 유효 구간만 determinate 진행바, 준비·요청 구간은 스피너+단계텍스트.
- G3. **"서버가 진실" 정직 문구**(사용자 승인 — 시안 3곳 수정):
  - (i) 큰 "68%" 제거 → 바 유지 + 주정보 "N페이지 중 M페이지 분석 완료"(페이지비율 ≠ 시간비율).
  - (ii) 분석 구간 버튼 "분석 취소" → **"나가기"**(서버 작업은 계속, 관찰만 중단). 업로드 구간만 진짜 "취소"(전송 중단).
  - (iii) 초록 "앱 닫아도 계속됩니다" Notice는 **분석 구간 한정**. 업로드 구간은 "앱을 열어 두세요"(반대 안내 — FOREGROUND 전송).
- G4. **동작 보존**: 업로드→분석 자동 시작·진행 카운트·취소 분기(업로드=실제 중단, 분석=관찰 중단, 항상 활성)·재시도·done/partial→/result·draft 잠금·계정전환 무효화·늦은 응답 가드(runId/stateVersion).
- G5. **접근성/모션**: determinate만 progressbar(now/min/max+의미 읽기), indeterminate 가짜 now=0 금지. 화면 전환 시 h1 초점 1회(카운트마다 X), 단계 전환/완료/실패만 live announce. reduced-motion에서 스캔라인 off. 취소/나가기 터치 44pt.

## 3. 목표가 아닌 것 (Non-goals)
- N1. **읽기전용 페이지 목록 펼침**(진행 중 장수·순서 확인) — 히어로 "계약서 N페이지" 카운트만. 전체 펼침은 후속.
- N2. **"백그라운드로"**(분석 유지한 채 홈 복귀·documentId 보존 재관찰) — 후속. 이번 "나가기"는 기존 동작(관찰 중단+idle 복귀) 유지.
- N3. **서버 분석-취소 엔드포인트** 신설 — 백엔드 범위. 프론트는 현 계약(관찰만) 기준 정직 표현.
- N4. 결과·마이페이지·최근목록 화면 리디자인(순서3~5)·다크·구독·경과시간 "평소보다 오래".

## 4. 제약 (Constraints)
- **서버가 진실**: 진행률·단계를 클라에서 지어내지 않음. 가짜 % 금지. 지속/취소 문구는 확인된 서버 계약(업로드=FOREGROUND, 분석=서버 독립+취소 엔드포인트 없음)에서만 도출.
- merged phase 제어·useUpload·useAnalysis·자동 시작 ref·계정전환 무효화 **로직 불변**(라벨·조건만 모드화). 공통 Notice·Button·진행바 재사용(신규 공용 최소화).
- ProcessingScreen은 표시 전용(presentational): app이 주입하는 merged analyze props만 수신, feature→feature import 금지. 완료 전 `checks.sh` PASS(ui 포함).

## Acceptance
- [x] `idle`→PageList(페이지 리뷰+분석하기), 그 외(active+터미널)→전용 ProcessingScreen. 완료 순간 UI가 사라지는 모순 없음.
- [x] 업로드 중/분석 중 모드 분기 — determinate(카운트)·indeterminate(스피너) 구분, 가짜 % 없음, "M/N페이지" 주정보.
- [x] 정직 문구 3곳: 분석=버튼 "나가기"·초록 "앱 닫아도 계속"(분석만), 업로드=버튼 "취소"·"앱 열어 두세요". 큰 68% 없음.
- [x] 터미널: done/partial→"결과 보기"(/result)+"새 계약서 분석"(탈출구), partial 불완전성 명시, failed·error→"다시 시도"+"페이지 확인"(복귀).
- [x] 동작 보존(자동 시작·취소 분기 non-busy·재시도·잠금·계정전환·늦은 응답 가드) + 접근성(progressbar now/max·header 초점·reduced-motion·44pt).
- [x] 단위(ProcessingScreen 8 + Notice success) + 게이트 PASS(mobile 133·ui 28). **시뮬레이터 실측은 후속**(로그인 세션 만료 + Kakao OAuth 구동 불가 → 순서1과 동일 후속; 모드 로직은 단위로 커버).
