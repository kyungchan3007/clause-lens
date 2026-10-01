# 0040 — 과정 기록 (trace)

## 판단
- 사용자: 캡처 플로우(담은 페이지 등)에서 홈으로 나갈 버튼이 없음("일단 홈으로 돌아가기 버튼 필요"). routes는 back 있음.
- BrandHeader에 onHome(ChevronLeft) 추가 — hasPages일 때만. onReset 재사용(초기화→빈 홈). 빠른 요구라 확인 다이얼로그 없이 즉시(후속 판단).

## 막힘 / 되돌림
- (구현 중)

## 추가 (PR 리뷰 #117)
- P1(파괴적 즉시 초기화) 타당 → app/index `onHome`을 **Alert 확인 다이얼로그**(취소/홈으로 destructive)로 감싸 onReset 호출. 오터치로 담은 페이지·진행 분석 소실 방지. (사용자도 확인창 가능성 언급.)
