<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #194

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/194
- 캡처: 2026-10-14

---
- 배경: 사용 라이브러리가 README 한 곳에 정리돼 있지 않음(상단 뱃지·인프라표·개발환경표에 분산)
- 변경: \`🗂️ 모노레포 구조\` 다음에 \`🧰 기술 스택\` 섹션(계층별 표) 신설 + 목차에 항목 추가
- 그룹: 앱 · 스타일링(Tailwind CSS·NativeWind·css-interop·토큰) · 서버·워커 · 공용 · 개발
- 정확성(실제 package.json 기준): 검증은 zod(class-validator 미사용) · 위험 조항 분석은 Claude(@anthropic-ai/sdk) · sharp·AWS S3 SDK 포함
- 수용: 섹션 렌더 확인 · \`bash agents/harness/evals/checks.sh\` ALL PASS
