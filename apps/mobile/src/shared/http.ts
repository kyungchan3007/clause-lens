// 공유 HTTP 오류 — 여러 기능의 api가 동일 클래스를 써서 status 기반 분기(instanceof)가 일관되게.
export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}
