import type { Observable } from "rxjs";

// 분석 상태 변경 알림 포트(pub/sub). worker가 발행 → api가 구독해 SSE로 push.
// 알림은 "바뀌었다"는 신호(틱)만 전달하고, 실제 상태는 api가 DB에서 재조회한다(worker→DTO 결합 제거).
export abstract class AnalysisNotificationPort {
  // 해당 문서의 상태 변경 틱 스트림. 구독 해제 시 자원 정리(refcount)는 어댑터 책임.
  abstract watch(documentId: string): Observable<void>;
}
