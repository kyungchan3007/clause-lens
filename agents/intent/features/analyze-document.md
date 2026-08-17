# Feature Guide: 분석하기

## 사용자 목표

업로드된 계약서를 OCR 처리하고 위험 가능성이 있는 조항과 위치를 확인한다.

## 관련 도메인

- Auth & Entitlement
- Document & Page
- Analysis Job
- Clause Result
- Highlight Rendering

## 구현 흐름

1. 앱이 로그인과 분석 가능 횟수를 확인한다.
2. 미업로드 Draft가 있으면 먼저 S3 업로드를 완료한다.
3. NestJS에 문서 분석을 요청한다.
4. 서버가 권한, 무료 횟수, 페이지 revision을 검증한다.
5. 서버가 SQS 작업을 등록하고 jobId를 반환한다.
6. 앱은 PROCESSING 화면을 표시하고 상태를 조회한다.
7. Worker가 Vision OCR과 위험 조항 분석을 수행한다.
8. 완료되면 앱이 최신 결과를 다시 조회한다.
9. 앱은 결과 목록과 Skia 하이라이트를 표시한다.

## UI 상태

- 분석 준비
- 업로드 중
- 분석 요청 중
- 분석 중
- 분석 완료
- 부분 실패
- 전체 실패 및 재시도
- 무료 횟수 소진

## Acceptance Checklist

- [ ] 분석 요청은 중복 탭에도 한 번만 접수된다.
- [ ] API는 OCR 완료를 기다리지 않고 jobId를 반환한다.
- [ ] 앱 종료 후 재진입해도 서버 job 상태를 복원한다.
- [ ] 페이지별 실패와 성공을 구분해서 표시한다.
- [ ] 완료 결과가 현재 page revision과 일치한다.
- [ ] 무료 횟수 차감은 서버 결과와 동기화된다.

