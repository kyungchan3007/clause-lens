# 0044 — 과정 기록 (trace)

## 판단
- 사용자 지시: 홈 리디자인 후 썩은 Maestro 시나리오 동기화, 이슈→브랜치→spec→yaml 순서, Notion 미기록.
- #122(#119) 미머지 상태지만 yaml·문서만 바꾸고 result 동작 불변이라 develop에서 분기. spec 번호는 0042가 #122에 있으므로 0043으로 잡았으나, #124(0043-profile-hook)와 중복 → 0044로 변경(하네스가 TASKS done 행을 앞 4자리 번호로 spec과 매칭하므로 중복 시 엉뚱한 spec 검사).
- 전수 확인: 17개 yaml 중 capture-gate를 제외한 16개가 `계약서를 담아주세요` 앵커 의존(사용자가 언급한 7개보다 넓음). capture-gate도 assertNotVisible로 의존(통과는 하나 무의미 단언).
- 추가 발견: `1페이지` 텍스트 제거(번호만 표시), `페이지 삭제`→`1페이지 삭제`, `업로드 완료`/`분석 완료` 문구 제거, `촬영하기`→`계약서 촬영`.

## 막힘 / 되돌림
- upload 실측 중 "로그인이 필요해요." — 원인: access TTL 15분(`ACCESS_TOKEN_TTL_SECONDS` 기본 900) + 앱 자동 refresh 없음(authStore 주석 "refresh 자동화는 후속"). restore는 실행 시점에만 /auth/me 검증 → 실행 중 만료되면 업로드 presign 401. 재실행 시 로그인 화면 확인. yaml 문제 아님 → 범위 밖, 보고·후속.
- 세션이 이미 끊겼으므로 capture-gate(clearState)를 이때 실측. 카카오 재로그인은 수동이라 upload·analysis·result 실측 중단.
- 피커 자동화: OS PHPicker는 Maestro 밖 프로세스 → 시뮬 좌표 탭으로 대체(yaml엔 수동 표기 유지).
