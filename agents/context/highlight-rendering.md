# Highlight Rendering Domain Guide

## 책임

- 서버의 원본 좌표를 현재 화면 이미지 좌표로 변환한다.
- Skia로 위험 조항 영역을 렌더링한다.
- 위험도별 색상, 투명도, 선택 상태를 표시한다.

## 좌표 변환

```ts
const scaleX = displayedWidth / imageWidth;
const scaleY = displayedHeight / imageHeight;

const rect = {
  x: box.x * scaleX + offsetX,
  y: box.y * scaleY + offsetY,
  width: box.width * scaleX,
  height: box.height * scaleY,
};
```

`contain` 렌더링처럼 여백이 생기는 경우 반드시 `offsetX`, `offsetY`를 포함합니다. 회전을 지원한다면 회전 보정은 별도 순수 함수로 분리합니다.

## 불변 조건

- 좌표 변환은 순수 함수로 구현하고 단위 테스트 가능해야 한다.
- 원본 OCR 좌표는 변경하지 않는다.
- Skia Canvas 크기와 실제 이미지 표시 영역을 구분한다.
- 색상은 UI 토큰으로 관리하며 위험도 데이터 자체를 변경하지 않는다.
- 하이라이트가 없어도 원본 이미지는 정상 표시되어야 한다.

## 성능 규칙

- 렌더마다 좌표 전체를 불필요하게 재계산하지 않는다.
- 페이지가 화면에 없을 때 무거운 Canvas 렌더링을 중단한다.
- 다수 box는 가능한 한 메모이제이션하거나 그룹 단위로 처리한다.

## 검증

- 서로 다른 화면 비율과 기기 크기에서 같은 문장을 가리킨다.
- 확대·축소·스크롤 이후에도 이미지와 하이라이트가 일치한다.
- 색상과 투명도 변경이 분석 데이터에 영향을 주지 않는다.

