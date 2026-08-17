# Document & Page Domain Guide

## 책임

- 하나의 계약서 세션과 그 안의 페이지를 관리한다.
- 페이지 순서, imageKey, revision, 현재 분석 상태를 관리한다.
- 페이지 교체와 삭제가 다른 페이지 결과에 미치는 범위를 제한한다.

## 권장 모델

```ts
type DocumentSession = {
  id: string;
  ownerId: string;
  status: "DRAFT" | "PROCESSING" | "COMPLETED" | "FAILED";
  pages: DocumentPage[];
};

type DocumentPage = {
  id: string;
  order: number;
  imageKey: string;
  revision: number;
  analysisStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
};
```

## 불변 조건

- `pageId`는 이미지를 교체해도 유지하고 `revision`을 증가시킨다.
- 페이지 분석과 결과는 반드시 revision을 포함한다.
- 특정 페이지 교체는 해당 페이지만 무효화하고 재분석한다.
- 페이지 순서는 중복되지 않으며 서버 저장 후 서버 결과로 다시 동기화한다.
- 삭제된 페이지나 오래된 revision의 결과는 조회 결과에 포함하지 않는다.

## 클라이언트 Draft

- 새로 촬영한 이미지와 순서 변경은 저장 전까지 Draft가 될 수 있다.
- Draft는 서버 Entity와 별도 타입으로 관리한다.
- 업로드와 서버 반영이 성공한 뒤에만 Draft를 제거한다.

## 검증

- Page 2 교체 시 Page 1과 Page 3의 revision과 결과가 유지된다.
- 연속 두 번 교체했을 때 첫 번째 Worker 결과가 저장되지 않는다.
- 저장 실패 시 기존 서버 페이지와 로컬 Draft가 모두 보존된다.

