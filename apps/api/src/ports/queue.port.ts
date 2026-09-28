// 분석 실행 등록 포트(producer). 외부 큐(BullMQ)는 어댑터로만 접근.
// 상태 알림은 별도 포트(AnalysisNotificationPort) — 큐 completed 이벤트와 도메인 완료를 섞지 않는다.
export abstract class QueuePort {
  // 문서 job 1개를 큐에 등록(A 모델). jobId를 큐 job id로 써서 중복 add를 멱등 처리.
  abstract enqueueAnalysis(jobId: string): Promise<void>;
}
