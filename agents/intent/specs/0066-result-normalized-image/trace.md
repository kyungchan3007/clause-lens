# 0066 — 결과 정규화 이미지 영속·제공 (TRACE)

- **이슈:** #175

## 2026-10-08

### 착수
- 결과 Skia 전환(#176)의 **선행 백엔드 이슈**로 분리. A안(서버 정규화본 제공) 확정 — 사용자 "정석대로·이후에도 버그 안 생기게".
- 원문 고정: `pnpm request 175` → request.md(불변).

### 설계 토론 (Codex 적대적 검토, 2026-10-08)
- Codex exec로 "결과 SVG→Skia A안" 적대적 검토 수행(검토만; Codex가 임의로 TASKS/JOURNAL 수정·게이트 실행한 것은 되돌림).
- 핵심 지적 → 이 이슈로 귀결:
  - worker uprightBytes는 **OCR 입력으로만 쓰고 앱 제공용으로 저장 안 함** → A안의 숨은 전제가 깨짐. **정규화 이미지를 서버가 공급**해야 함(이 이슈).
  - `isSizeConsistent`(크기 비교)는 **EXIF 반전·180°·동일크기 다른 페이지**를 못 거름 → 이미지·결과를 **revision identity로 결합**.
  - EXIF 1~8 실측은 0022에서 후속으로 남아 있었음 → 이 이슈에서 fixture 검증.
  - 보관 만료 시 정규화 asset도 함께 삭제되도록 retention 대상 등록(#164 정합).
- 결론: SDD §3 대안표로 확정(A·revision identity·OCR 바이트 재사용·기존 엔티티 확장).

### 다음
- 구현: contracts(08) DTO → worker put → api 응답 → retention 등록 → 테스트. (#176 앱 Skia는 이 이슈 머지 후 그 위에서.)
