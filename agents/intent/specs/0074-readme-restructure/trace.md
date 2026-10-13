# TRACE — README 재구성 (#190)

- 2026-10-13 착수. #188에서 최신화(상태·수치)는 끝났고, 이번은 구조·표현 정돈.
- 사용자 확정(2026-10-13):
  - 상단 중점 순서 = ①(중심) 서버 권위 비동기 분석 파이프라인(OCR Google Vision·Skia·큐) → ②에이전틱 하네스(부수 공부) → ③보관·삭제 상태 머신(부수 기술) → ④디자인 시스템·FSD(부수 공부)
  - 분리 = 얇은 README + agents/context 링크 위임
- 링크 대상 실재 확인: agents/context/{backend-architecture,frontend-architecture,analysis-job,highlight-rendering,domain-map,architecture}.md, agents/README.md, agents/harness/README.md 존재.
- 판단: 중복 다이어그램(책임분리·상태관리·페이지교체·서버구성 4개 mermaid)은 핵심 end-to-end 1개만 남기고 나머지는 context로 위임. 분석결과 JSON 예시는 구체적이라 유지.
