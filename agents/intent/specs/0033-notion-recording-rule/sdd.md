# 0033 — Notion 기록 규칙 지침서화 — SDD

> **관련 PRD**: prd.md · **이슈:** #103

## 1. 접근 (Approach)
- `agents/harness/notion-recording.md`(신규): ① 원칙(완료·변경 시 영향 섹션 전체 갱신, 01 편중 금지) ② **섹션 맵 표**(작업 유형 → 섹션) ③ 머지 반영(미머지→머지·PR 번호) ④ 포맷(날짜 스탬프·한눈 스캔) ⑤ 편집 함정(`<page url>`=이동, 자식페이지 move). 허브·주요 섹션 page id 메모.
- `AGENTS.md` §4 작업 루프에 한 줄 링크 추가(기존 github-issue-templates 링크 옆).
- 섹션 맵(허브 3d1deddc-12a7-80f0-bb7f-c1f8403287a5):
  01 진행상황(항상) · 02 정책(정책 변경) · 03 사용자 기능 및 화면 흐름(기능·도메인 설계 → 자식 "… 기능 설계" 페이지 + 목차 행) · 13 기술결정(기술 선택) · 14 화면별 TASK(화면 구현 로그) · 15 디자인 시스템 설계(토큰·테마·공통 컴포넌트·UI/UX) · 주차 작업정리(날짜별).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| harness 문서 + AGENTS 링크 | Progressive Disclosure·두 AI 공용·확장 쉬움 | 문서 1개 추가 | ✅ |
| AGENTS.md 본문에 전체 규칙 | 한 곳 | AGENTS 비대(짧게 유지 원칙 위반) | ❌ |
| 메모리에만 유지(현행) | 가벼움 | 레포 미공유·Codex 미적용·반복 누락 | ❌ |
| 자동 게이트(기록 누락 차단) | 강제력 | Notion 상태를 오프라인 게이트가 못 봄·복잡 | ❌(후속) |

## 3. 영향받는 코드 (Touched Surface)
- `agents/harness/notion-recording.md`(신규) · `AGENTS.md`(§4 링크 1줄) · TASKS(chore 행).

## 4. 검증 (Verification)
- 문서 변경만 — 게이트 `checks.sh` PASS(타입·테스트 영향 없음, 기록 게이트 통과).
- 링크 유효성 육안 확인(AGENTS → notion-recording).
- 적용 검증: 이번 대화의 15 신설·03 재열람 설계·전 섹션 갱신이 섹션 맵과 일치함을 사례로 확인.

## 5. 리스크 / 롤백
- 낮음(문서). 규칙 과다 시 축약. 자동 강제는 후속 이슈로 분리.
