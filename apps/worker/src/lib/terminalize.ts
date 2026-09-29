import { confirmPageAnalysisTx } from "@clause-lens/db/analysis";

import type { NotificationPublisher } from "../notification.publisher";
import type { PrismaService } from "../prisma.service";

// 잡의 미종결 페이지를 종결(0021 §⑤ stuck 복구). failed 리스너·reconciler 공용.
// worker_failed(retryable) — 잡 최종 실패/유실로 인한 종결.
export async function terminalizeStuckJob(
  prisma: PrismaService,
  publisher: NotificationPublisher,
  jobId: string,
): Promise<void> {
  const job = await prisma.analysisJob.findUnique({
    where: { id: jobId },
    include: { pages: true },
  });
  if (!job) return;
  if (job.status === "done" || job.status === "partial" || job.status === "failed") {
    return;
  }
  for (const pa of job.pages) {
    if (pa.status === "done" || pa.status === "failed") continue;
    const res = await confirmPageAnalysisTx(prisma, {
      jobId,
      outcome: { pageId: pa.pageId, ok: false, errorCode: "worker_failed", retryable: true },
    });
    await publisher.publish(job.documentId, res.stateVersion);
  }
}
