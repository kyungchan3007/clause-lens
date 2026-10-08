# 0067 — 결과 화면 Skia 하이라이트 전환 + 구역 탭 (TRACE)

- **이슈:** #176 · **의존:** #175

## 2026-10-08

### 착수
- 결과 하이라이트 Skia 전환(A안) + 사진 구역 탭. 사용자 요구: Skia로 문서 렌더·구역 색칠, 설명 구간은 그대로. 탭 동작은 "사진 구역도 탭 가능" 선택.
- 원문 고정: `pnpm request 176` → request.md(불변).

### 설계 토론 (Codex 적대적 검토, 2026-10-08)
- A안(정규화 이미지) vs B안(원본) 기술 검토 → A 확정(좌표 정합·EXIF/메모리). 근거: 박스가 서버 upright 픽셀 공간에 묶임.
- Codex 지적 반영(SDD §3):
  - useImage 세대 검증·reject catch 부재 → **generation token + revision identity**로 stale(이전 이미지+현재 박스) 혼합 차단.
  - isSizeConsistent(크기)만으론 EXIF·다른페이지 통과 → #175 revision identity에 의존.
  - 탭 겹침 우선순위·44pt·변환 1회·메모리 예산·web CanvasKit 선import 차단.
  - Skia 성능 우위는 정적 탭만으론 미입증 → 채택 명분을 **화질·확대 로드맵**으로 명문화(과대광고 금지).
- 선행 의존 분리: 정규화 이미지 공급은 백엔드 #175(0066)로 떼어냄 — 이 이슈는 그 위에서 표현 레이어만 교체.
- (주의) Codex exec가 검토 범위를 넘어 TASKS/JOURNAL 수정·게이트 실행 → 되돌림. 설계 결론만 채택.

### 다음
- #175 머지 후: hitTest 순수함수 → SkiaHighlightCanvas → ResultScreen 교체 → maestro·게이트 → 시뮬 육안.
