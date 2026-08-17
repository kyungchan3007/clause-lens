# Clause Result Domain Guide

## 책임

- Google Vision 응답에서 텍스트와 좌표를 정규화한다.
- OCR 텍스트에서 위험 가능성이 있는 조항을 분석한다.
- 분석 조항과 원본 텍스트 좌표를 연결한다.

## 결과 계약

```ts
type ClauseResult = {
  id: string;
  pageId: string;
  revision: number;
  type: "AUTO_RENEWAL" | "PENALTY" | "TERMINATION_LIMIT" | "OTHER";
  title: string;
  text: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
  boxes: Array<{ x: number; y: number; width: number; height: number }>;
};
```

## 불변 조건

- Google Vision은 OCR 공급자이며 `title`, `riskLevel`, `explanation`을 생성하는 주체가 아니다.
- 좌표는 원본 이미지 픽셀 기준으로 저장한다.
- 모든 결과에 pageId와 revision을 포함한다.
- 분석 근거가 되는 원문을 결과와 연결한다.
- OCR 신뢰도가 낮거나 좌표 연결이 불가능한 결과를 확정적으로 표시하지 않는다.
- 법률 자문이 아니라 참고 정보라는 고지를 유지한다.

## 금지 사항

- 프론트에서 키워드만 보고 위험도를 다시 판정하지 않는다.
- 화면 크기에 맞게 변환된 좌표를 DB 원본 좌표로 덮어쓰지 않는다.
- OCR 전문과 계약서 원문을 운영 로그에 남기지 않는다.

## 검증

- 위험 조항 텍스트와 boxes가 같은 문장을 가리킨다.
- 페이지 회전과 이미지 크기가 달라도 원본 좌표 체계가 유지된다.
- 분석 결과가 없는 경우 정상적인 빈 결과로 처리된다.

