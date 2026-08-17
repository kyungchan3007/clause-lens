# 용어집 (Glossary)

두 AI가 같은 단어를 같은 뜻으로 쓰기 위한 공용 사전. 새 도메인 용어가 생기면 여기 추가.

| 용어 | 뜻 |
| --- | --- |
| **Draft** | 서버 전송 전, 클라이언트에만 존재하는 임시 페이지/편집 상태. |
| **revision** | 페이지 이미지의 버전 번호. 이미지 교체 시 증가하며, 오래된 OCR 작업은 이 값으로 무효화. |
| **imageKey** | S3 내 이미지 경로 식별자. API가 발급 (예: `documents/doc_01/page_02-r3.jpg`). |
| **Presigned URL** | 앱이 S3에 직접 업로드하도록 API가 발급하는 임시 서명 URL. |
| **clause** | 위험 가능성이 있는 계약 조항. `type·title·text·riskLevel·boxes`를 가짐. |
| **box** | 원본 이미지 픽셀 기준 하이라이트 사각형 `{x,y,width,height}`. 표시 시 스케일 변환. |
| **riskLevel** | 조항 위험도. `HIGH` 등. Worker의 분석 단계가 생성(Vision이 아님). |
| **jobId** | OCR 분석 작업 식별자. 상태: `PROCESSING` → `COMPLETED`/`FAILED`. |
| **Skia** | `@shopify/react-native-skia`. 이미지 위 하이라이트 렌더링에 사용. |
| **게이트(gate)** | 완료 선언 전 통과해야 하는 자동 검사 = `agents/harness/evals/checks.sh`. |
| **태스크 클레임** | 작업 전 TASKS.md에서 owner/status를 자신 것으로 바꿔 점유하는 행위. |
