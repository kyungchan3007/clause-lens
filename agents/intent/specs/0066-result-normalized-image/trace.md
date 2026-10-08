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

### 구현 (2026-10-08)
- **결정적 키 채택(SDD §4 Q1 확정 — DB 마이그레이션 없음)**: 정규화 이미지를 DB에 기록하지 않고 `normalizedImageKey(documentId,pageId,revision)` = `documents/{documentId}/pages/{pageId}/r{revision}/normalized.jpg`(Page.finalKey 형제·결정적)로 worker 쓰기·api presign이 동일 키 재구성. 스키마 변경·마이그레이션 불필요 → 리스크↓. put 실패 시 URL 404 → 앱은 이미지 없이 목록(기존 graceful). (설명 flag/명시 기록은 후속 하드닝 후보.)
- **contracts(08)**: `normalizedImageSchema{url,width,height,revision}` + `pageAnalysisResultSchema.normalizedImage?` + `normalizedImageKey()` + `NormalizedImage` 타입. (`packages/contracts/src/analysis.ts`)
- **worker**: `StoragePort.putObject` 추가(`ports/storage.port.ts`), `S3StorageAdapter`에 `PutObjectCommand` 구현. `analysis.processor.ts` — validateImage 직후 `uprightBytes`를 결정적 키로 put(best-effort try/catch+Logger.warn, OCR 입력 바이트 재사용·재디코드 없음). OCR 재사용 분기(bytes 없음)에선 put 생략(이미 존재).
- **api**: `StoragePort.presignGet(key,ttl)` 추가(`ports/storage.port.ts`·`MinioStorageAdapter` GetObjectCommand+getSignedUrl). `AnalysisService`에 StoragePort 주입(모듈 provide) + `attachNormalizedImages` — 완료(치수 존재) 페이지에 presigned GET URL 부착(TTL 3600s). 보관 만료(410)는 `getAnalysis`가 선차단 → 만료 문서엔 URL 미발급(접근 차단 정합).
- **테스트**: contracts(normalizedImage 스키마·키 2건), worker(putObject 호출·키 검증), api(normalizedImage 부착·치수 없으면 미부착·presign 키 검증). 게이트 `checks.sh` **ALL PASS**(contracts 25·api 86·worker 43 포함).

### 백엔드 스모크 + e2e 실측 (2026-10-08)
- 로컬 백엔드(postgres·redis·네이티브 MinIO·API·worker 실제 Vision+Claude·Metro) 기동, 시뮬 로그인(사용자), 갤러리 계약서 분석 1회.
- **#175 왕복 검증 성공**: worker가 `documents/{doc}/pages/{page}/r1/normalized.jpg`를 MinIO에 저장(99KiB) → API 결과 `normalizedImage{url, width:1200, height:1600, revision:1}`(치수·revision 정합) → 그 presigned GET **HTTP 200 · image/jpeg · 100,949 bytes**. (JWT는 JWT_ACCESS_SECRET로 발급해 실제 엔드포인트 호출.)
- e2e(maestro): `result.yaml`(업로드→분석→결과→#169 드래그시트) 포함 14개 플로우 통과. 결과 화면은 현행 react-native-svg 하이라이트로 정상 — #175가 공급한 이미지의 **앱 소비(Skia 렌더)는 #176**.
- 보관 만료 접근 차단은 getAnalysis 410 선차단으로 유지(코드·단위). 물리 삭제는 #164.

### 남음 / 다음
- **물리 삭제는 #164**(실삭제 잡): 결정적 키 규칙을 #164가 참조해 정규화 asset도 함께 삭제(retention 대상 등록). 이 이슈는 "접근 차단(만료 시 URL 미발급)"까지.
- **EXIF 1~8 실측 fixture**: image-validator의 `.rotate()`가 8종 방향을 세우는지 — 현 단위는 목 기반. 실 fixture 검증은 후속(0022 후속과 동일 기준).
- #176 앱 Skia는 이 이슈 머지 후 그 위에서 `normalizedImage.url` 소비.
