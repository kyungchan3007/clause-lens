# Feature Guide: 특정 페이지 이미지 교체

## 사용자 목표

계약서 전체를 다시 처리하지 않고 잘못 촬영한 한 페이지만 교체하고 재분석한다.

## 관련 도메인

- Document & Page
- Upload & Storage
- Analysis Job
- Clause Result

## 구현 흐름

1. 사용자가 교체할 페이지에서 새 이미지를 선택한다.
2. 앱이 기존 페이지 위에 Draft 미리보기를 표시한다.
3. 새 이미지를 S3에 업로드한다.
4. API가 page imageKey를 교체하고 revision을 증가시킨다.
5. 기존 revision의 OCR와 분석 결과를 무효화한다.
6. 새 revision에 대한 분석 작업만 등록한다.
7. Worker가 현재 revision을 확인하고 해당 페이지만 분석한다.
8. 앱이 최신 결과를 받아 Draft를 제거한다.

## 경쟁 상태 규칙

- 사용자가 연속 교체하면 가장 최신 revision만 유효하다.
- 오래된 Worker가 늦게 끝나도 최신 결과를 덮어쓸 수 없다.
- 교체 실패 시 기존 서버 이미지와 결과를 유지한다.

## Acceptance Checklist

- [ ] 교체 전까지 기존 결과가 보존된다.
- [ ] 교체한 페이지만 revision이 증가한다.
- [ ] 다른 페이지는 재분석하지 않는다.
- [ ] 오래된 작업 결과가 저장되지 않는다.
- [ ] 성공 후 앱이 최신 서버 결과로 동기화된다.

