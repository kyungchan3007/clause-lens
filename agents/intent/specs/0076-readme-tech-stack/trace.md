# TRACE — README 기술 스택 섹션 추가 (#194)

- 2026-10-14 착수. 사용자 지적 "리드미에 사용 라이브러리 표시 안 했다 — 어디가 좋을까".
- 배치 논의: 상단은 "🎯 핵심 설계" 포커스 유지 위해 피하고, `🗂️ 모노레포 구조` 다음(A안)으로 합의.
- 그룹 표 초안 사용자 승인. 스타일링 행 분리(Tailwind CSS→NativeWind 관계 노출) + 디자인 토큰 포함.
- package.json 대조로 2건 교정: ① `class-validator` 미사용(검증=zod) → 제외 ② 위험 조항 분석 Claude(@anthropic-ai/sdk) 누락 → 추가. 추가로 sharp·AWS S3 SDK 반영.
