# PRD — 결과 정규화(upright) 이미지 영속·제공

- **이슈:** #175
- **상태**: draft
- **작성**: Claude · **날짜**: 2026-10-08
- **관련 태스크**: 결과 Skia 하이라이트 기반(앱 #176 선행)

## 1. 문제 (Problem)
- 결과 하이라이트를 Skia로 전환(#176)하려면 **서버가 분석한 정규화(upright) 이미지**를 앱이 그려야 좌표가 정합한다.
- 현재 worker의 upright 이미지는 **OCR 입력으로만 쓰고 저장하지 않는다**. 앱은 로컬 캡처 스냅샷을 그리고 `isSizeConsistent`(크기 비교)로만 검증한다.
- 크기 일치만으로는 **EXIF 반전·180° 회전·"크기는 같은 다른 페이지"**를 구분하지 못한다(Codex 적대적 검토 2026-10-08).

## 2. 목표 (Goals)
- G1. worker의 upright 이미지를 **결과용 asset으로 S3에 영속**(OCR 입력 바이트 재사용, 중복 디코드 없음).
- G2. API 결과에 **정규화 이미지 URL + revision/identity**(문서·페이지·분석 리비전) 반환 — 계약(08) 갱신.
- G3. 좌표 기준을 그 정규화 이미지 픽셀(= 기존 `imageWidth/imageHeight`)로 **명문화**.
- G4. 보관 만료(7일)·접근 차단을 정규화 이미지에도 동일 적용(#164 실삭제 잡과 정합).

## 3. 목표가 아닌 것 (Non-goals)
- N1. 앱 Skia 렌더·구역 탭(#176). N2. 핀치줌·원본 다운로드·역방향 재분석.
- N3. 원본(raw) 캡처 보관(정규화본만 결과용으로 보관).

## 4. 사용자 흐름 (User Flow)
1. 촬영 → 업로드 → worker가 OCR 전 upright 정규화 수행(기존).
2. worker가 그 **정규화 바이트를 결과 asset으로 S3에 저장**(페이지·리비전 키).
3. 분석 완료 → API 결과에 정규화 이미지 URL + revision 포함.
4. 앱(#176)이 그 이미지를 Skia로 그리고, 같은 revision의 박스만 올린다.

## 5. 성공 지표 (Success Metrics)
- 앱이 서버 정규화본을 받아 그리면 **좌표 정합 100%**(크기뿐 아니라 리비전 일치). checks.sh PASS.
- 보관 만료 시 정규화 이미지도 접근 차단(세션/재열람 정책과 일치).

## 6. 제약 (Constraints)
- S3(MinIO/Railway) 보관 정책·키 규칙 준수. 서버 진실. 새 비밀값 노션/저장소 금지.
- OCR 입력 바이트 재사용(이미 디코드/정규화한 결과를 다시 만들지 않음).
- 계약(08) 변경은 contracts 패키지·API·worker·앱이 함께 일치(타입 drift 금지).

## Acceptance
- [ ] worker upright(정규화) 이미지 S3 영속(결과 asset), OCR 입력 바이트 재사용(중복 디코드 없음).
- [ ] API 결과에 정규화 이미지 URL + revision/identity 반환, 계약 08 갱신(contracts·API·worker·앱 타입 일치).
- [ ] 보관 만료(7일)·접근 차단 정책 반영(#164 정합, 재열람 410과 일관).
- [ ] 좌표 기준 = 정규화 이미지 픽셀 명문화(0022·0066 trace 연결).
- [ ] 단위/계약 테스트 + `bash agents/harness/evals/checks.sh` PASS.

## 7. 미해결 질문 (Open Questions)
- Q1. 정규화 asset 키·수명을 기존 ResultImage/스냅샷과 통합할지 별도 둘지 — SDD에서 확정.
- Q2. revision 단위(문서·페이지·분석) 식별자 형태 — SDD에서 확정(기존 엔티티 재사용 우선).
