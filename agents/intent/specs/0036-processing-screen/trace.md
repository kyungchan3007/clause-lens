# 0036 — 과정 기록 (trace)

## 판단
- **착수 전 Codex 적대 설계 토론**(order2). 제안=전용 Analyzing 화면 전환. 핵심 반영:
  - (B) `active`만 전용 화면 쓰면 done/partial/failed/error 순간 터미널 UI가 사라지는 **모순** → `idle` 외 전부(active+터미널) 전용 화면, 페이지 수정 필요 복구만 PageList 복귀.
  - (C) 큰 "68%"는 페이지비율≠시간비율 → 제거, "M/N페이지 분석 완료"를 주정보. determinate는 phase+유효 카운트+totalCount>0.
  - (D) indeterminate에 흐르는 바/스캔 중첩 금지 → **스피너 1개 + 단계텍스트**, 히어로 정적.
  - (E/G) **서버 계약 코드 확인이 핵심**: 업로드=FOREGROUND(닫으면 중단·취소=실제 중단), 분석=서버 job 독립 실행·클라 관찰만·취소 엔드포인트 없음 → 분석 "취소"는 거짓 약속.
  - (G#1) 취소 후 늦은 응답·계정전환은 **기존 runId/stateVersion 가드가 이미 방어** → 신규 불필요.
  - (A) 전체화면이 페이지 목록을 가림 → "계약서 N페이지" 카운트로 경량 대체(전체 펼침은 후속).
- **사용자 결정(AskUserQuestion)**: **정직 우선 — 시안 3곳 수정**. (i)68% 제거 (ii)분석 버튼 "나가기" (iii)초록 "앱 닫아도 계속"은 분석 구간만·업로드는 "앱 열어 두세요".

## 막힘 / 되돌림
- **렌더 라우팅**: `hasPages && phase==='idle'`→CaptureScreen(PageList), `hasPages && phase!=='idle'`→ProcessingScreen, else 온보딩. m.phase 유니온에 'idle' 포함 → ProcessingScreen엔 `Exclude<_, 'idle'>` 캐스트(라우팅이 non-idle 보장).
- **done/partial 탈출구**: 전용 전체화면이 페이지 목록을 가려 done에서 "새 분석"으로 못 빠져나가는 트랩 발견(인라인 시절도 유사) → `onReset`(draft clear + upload/analysis reset + ref 해제) 추가, done/partial에 ghost "새 계약서 분석". 자동 이동은 하지 않음(사용자 제어).
- **PageList 축소**: 진행·터미널 분기(상태 라벨·진행바·취소/다시시도/결과보기) 제거 → idle 전용(담은 페이지 + 분석하기 + quota). `AnalyzeControls`를 `{onAnalyze}`로 축소(기존 phase/카운트/콜백 다수 제거) — 소비처 CaptureScreen/app만 영향.
- **Notice success tone 추가**: 기존 info/neutral(muted 텍스트) 외형 보존, success만 bg-success-bg+text-success-text. icon ShieldCheck 레지스트리 추가.
- **DocScanGraphic**: 스캔 라인 Animated.loop, `AccessibilityInfo.isReduceMotionEnabled`+이벤트 구독으로 reduced-motion이면 정적 중앙 고정. 장식 → accessibilityElementsHidden. 테스트에선 목(애니메이션 노이즈 회피).
- **정직 3곳(사용자 승인)**: 분석 버튼 "나가기"(서버 취소 불가·관찰만 중단), 큰 % 제거→"M/N페이지 분석 완료" 주정보, 초록 "앱 닫아도 계속"은 분석 구간만·업로드는 "앱 열어 두세요".
- 늦은 응답·계정전환 가드는 기존 runId/stateVersion으로 충분 → 신규 코드 없음.
- **진행바 재설계(사용자 실측 피드백)**: 최초 구현은 determinate 채움 바(uploading·analyzing=sent/total). 사용자가 시뮬레이터에서 **1페이지 문서 → 바가 0/1(0%)에 멈춰 보임** 지적. 서버 계약 재확인: `analysisStatusResponseSchema`는 `job.totalPages` + `pages[].status`(pending/processing/done/failed)만 — **percent·페이지 내부 진행 없음**. 워커도 페이지를 pending→done/failed 터미널만 기록(중간 processing 미기록). 즉 진행 신호=완료 페이지 수뿐 → 1페이지는 채움 구간이 없음. **사용자 결정**: 흐르는 바(indeterminate)로 교체(위치 주장 X·가짜 % 없음), 완료 수는 다페이지만 텍스트. 백엔드 percent는 후속(페이지당 OCR/분석 2단계가 최선이라 1페이지엔 효용 적음).
- **라이브 검증**: 시뮬레이터에서 ProcessingScreen **error 모드** 렌더 확인(세션 만료 → "분석에 문제가 생겼어요/로그인이 필요해요"+다시 시도+페이지 확인). **흐르는 바(진행 중) 라이브 육안은 유효 세션+무료 횟수(현재 0) 필요 → 후속**. 모드 로직은 단위로 커버.
- **후속**: 읽기전용 페이지 목록 펼침 / "백그라운드로"(documentId 보존 재관찰) / 서버 분석-취소 엔드포인트 / **백엔드 진행 percent(페이지당 단계) 이슈** / 경과시간 문구 / 로그인+무료횟수 있을 때 흐르는 바 육안.
