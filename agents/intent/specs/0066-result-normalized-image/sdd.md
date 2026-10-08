# SDD — 결과 정규화(upright) 이미지 영속·제공 (#175)

- **이슈:** #175 · **선행 for**: #176(앱 Skia) · **근거 번복**: 0022(§⑤ SVG 결정)
- **작성**: Claude · **날짜**: 2026-10-08

## 1. 설계 개요
- worker가 OCR 전에 만드는 **upright(EXIF 정규화) 바이트**를 버리지 않고 **결과용 asset으로 S3에 저장**한다.
- 분석 결과 응답에 그 asset의 **접근 URL + revision/identity**를 실어, 앱이 "서버가 본 바로 그 이미지"를 그리고 같은 리비전의 박스만 올리게 한다.
- 좌표계는 그대로 **정규화 이미지 픽셀**(`imageWidth/imageHeight`) — 변환 로직 변경 없음. 바뀌는 건 "앱이 그리는 이미지의 출처"뿐.

## 2. 접점 (touch points)
- `apps/worker` 분석 파이프라인: upright 바이트 생성 지점 → **S3 put(결과 asset)** 추가. OCR 입력과 **동일 바이트 재사용**(재디코드 금지).
- `packages/infra` S3 클라이언트: 결과 asset put/presign(기존 업로드 presign 패턴 재사용).
- `packages/db`(Prisma): 정규화 asset 키·revision 보관. 기존 `ResultImage`/문서·페이지 엔티티 **재사용 우선**(신규 테이블 최소화).
- `packages/contracts` + `apps/api`(documents/analysis 모듈): 결과 응답 DTO에 `normalizedImage{ url, width, height, revision }` 추가 — **08 계약 갱신**(contracts·api·worker·앱 타입 동시 일치).
- 보관/만료: 기존 7일 retention(`retainUntil`)·접근 차단(410) 경로에 정규화 asset 포함(#164 실삭제 잡이 같이 지우도록 키를 retention 대상에 등록).

## 3. 대안 검토 (Codex 적대적 검토 2026-10-08 반영)
| 질문 | 대안 | 결정 |
| --- | --- | --- |
| 앱이 그릴 이미지 | A 서버 정규화본 제공 / B 원본 그대로 / C 현 스냅샷 유지 | **A** — 사용자 "정석대로·버그 없게". B는 EXIF·해상도 역변환 리스크, C는 EXIF/다른페이지 못 거름 |
| 정합 검증 | 크기 비교(isSizeConsistent) / **revision identity 결합** | **revision identity** — 크기만으론 반전·180°·동일크기 다른 페이지 통과. 이미지·결과를 한 리비전으로 묶음 |
| 저장 바이트 | OCR 입력 재사용 / 결과용 재인코딩 | **OCR 입력 바이트 재사용** — 중복 디코드·화질 저하 없음 |
| 스키마 | 신규 테이블 / 기존 엔티티 확장 | 기존 ResultImage·페이지 엔티티 확장 우선(신규 최소) — 구현 시 확정(Q1·Q2) |

## 4. 데이터·계약 (초안)
- 결과 DTO(08): `page.normalizedImage = { url, width, height, revision }` (width/height = 좌표 기준, 기존 imageWidth/Height와 동일).
- `revision`: 문서·페이지·분석을 식별하는 안정 키(기존 식별자 조합 우선 — SDD 구현 단계 Q2 확정). 앱은 이미지·박스의 revision 일치 시에만 draw/hit.
- URL: presign(만료 짧게) 또는 세션 토큰 — 재열람·보관 정책과 동일 접근 제어.

## 5. 엣지·리스크
- **EXIF 1~8 실측**: 0022에서 후속으로 남았던 항목. worker 정규화가 8종 방향을 실제로 세우는지 fixture로 검증(이 이슈 범위에 포함).
- **보관 만료 정합**: 정규화 asset이 retention/삭제에서 누락되면 "결과는 사라졌는데 이미지만 남음" → 키를 retention 대상에 등록(#164와 교차 확인).
- **중복 저장**: OCR 입력과 결과 asset이 둘 다 영속되면 중복 — 같은 키/수명으로 통합 검토(Q1).
- **web**: 정규화 asset URL은 플랫폼 공통(앱 Skia는 #176).

## 6. 테스트
- 단위/계약: DTO에 normalizedImage 포함(contracts 타입), worker가 upright 바이트를 put하는지(목 S3), revision 생성 규칙.
- EXIF fixture: 방향 1~8 입력 → 저장 이미지가 upright인지.
- 보관: 만료 시 정규화 asset 접근 차단(410) 단위.
- 게이트: `bash agents/harness/evals/checks.sh` PASS.

## 7. 구현 순서(제안)
1. contracts(08)에 normalizedImage DTO + revision 타입 추가(앱·api·worker 공유).
2. worker: upright 바이트 S3 put(OCR 입력 재사용) + revision 기록.
3. api(documents/analysis): 결과 응답에 normalizedImage 채우기.
4. retention/삭제 경로에 정규화 asset 키 포함(#164 교차).
5. 단위·계약·EXIF fixture 테스트 → 게이트.
