<!-- 원문 고정(#155): 착수 시점의 이슈 본문 원문. 수정 금지(불변). 요구 변경은 덮어쓰지 말고 별도 기록으로 연결. -->
# 원문 — 이슈 #175

- 이슈: https://github.com/kyungchan3007/clause-lens/issues/175
- 캡처: 2026-10-08

---
## 배경
- 결과 화면을 Skia로 전환(연계 이슈: 앱)하려면 **서버가 본 정규화(upright) 이미지**를 앱이 그려야 좌표가 100% 맞음
- 현재 worker의 upright 이미지는 **OCR 입력으로만 쓰고 버림** → 앱엔 로컬 캡처 스냅샷만 있고 `isSizeConsistent`로 **크기만** 확인
- 크기 일치만으론 **EXIF 반전·180° 회전·"크기는 같은 다른 페이지"**를 못 거름 (Codex 적대적 설계 검토 지적, 2026-10-08)

## 요구 (확정)
- worker가 upright(EXIF 정규화) 이미지를 **S3에 영속**(결과용 asset) — OCR 입력 바이트 재사용
- API 결과(ResultImage/매칭)에서 **정규화 이미지 URL + revision/identity**(문서·페이지·분석 리비전) 반환 — **계약 08 갱신**
- 좌표 기준 = 그 정규화 이미지 픽셀(= 기존 `imageWidth/imageHeight`)
- **7일 보관 정책 동일 적용**(만료 시 접근 차단, #164 실삭제 잡과 정합)

## 설계 근거 (원문)
- A안(정규화 이미지만 좌표 보장) 결정 — 사용자 지시 "정석대로·이후에도 버그 안 생기게"
- Codex 검토: isSizeConsistent는 EXIF/다른 페이지 못 거름 → **이미지·결과를 revision identity로 결합** 필요. worker uprightBytes는 OCR 입력일 뿐 앱 제공 이미지로 저장 안 함(공백).

## 연계
- 앱 Skia 전환·구역 탭: #176 (이 이슈가 선행)

## 범위 밖
- 앱 Skia 렌더·구역 탭(#176), 핀치줌·다운로드

## Acceptance
- [ ] worker upright(정규화) 이미지 S3 영속(결과 asset), OCR 입력 바이트 재사용(중복 디코드 없음)
- [ ] API 결과에 정규화 이미지 URL + revision/identity 반환, 계약 08 갱신
- [ ] 보관 만료(7일)·접근 차단 정책 반영(#164 정합)
- [ ] 단위/계약 테스트 + `bash agents/harness/evals/checks.sh` PASS
