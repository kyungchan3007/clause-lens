# 0040 — 과정 기록 (trace)

## 판단
- 사용자: 캡처 플로우(담은 페이지 등)에서 홈으로 나갈 버튼이 없음("일단 홈으로 돌아가기 버튼 필요"). routes는 back 있음.
- BrandHeader에 onHome(ChevronLeft) 추가 — hasPages일 때만. onReset 재사용(초기화→빈 홈). 빠른 요구라 확인 다이얼로그 없이 즉시(후속 판단).

## 막힘 / 되돌림
- (구현 중)
