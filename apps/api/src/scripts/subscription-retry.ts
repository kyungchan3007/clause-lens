import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { SubscriptionJobsCliModule } from "../modules/subscriptions/subscription-jobs-cli.module";
import {
  SUBSCRIPTION_RETRY_DEFAULT_LIMIT,
  SUBSCRIPTION_RETRY_DEFAULT_MAX,
  SubscriptionRetryService,
  subscriptionJobsDisabled,
} from "../modules/subscriptions/subscription-retry.service";

// 수신함 재시도 잡(#165 Slice 3) — 사람/크론이 실행하는 standalone 스크립트.
// 기본 dry-run(쓰기·claim·attempts 변경 없음). 실행은 `--execute` 명시. kill-switch: SUBSCRIPTION_JOBS_DISABLED=1.
//   dry-run:  pnpm --filter @clause-lens/api exec tsx src/scripts/subscription-retry.ts
//   execute:  ... src/scripts/subscription-retry.ts --execute [--limit N] [--max N]
// setInterval·부트훅·HTTP 엔드포인트 금지(무인 자동실행 방지).

function intArg(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) {
    const n = Number.parseInt(args[i + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

async function main(): Promise<void> {
  const logger = new Logger("subscription-retry");
  if (subscriptionJobsDisabled()) {
    logger.warn("SUBSCRIPTION_JOBS_DISABLED — 실행 중단(kill-switch).");
    return;
  }

  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const limit = intArg(args, "--limit", SUBSCRIPTION_RETRY_DEFAULT_LIMIT);
  const cap = intArg(args, "--max", SUBSCRIPTION_RETRY_DEFAULT_MAX);

  const app = await NestFactory.createApplicationContext(SubscriptionJobsCliModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const svc = app.get(SubscriptionRetryService);
    if (!execute) {
      const r = await svc.dryRun(new Date(), limit);
      logger.log(`DRY-RUN — 후보 ${r.totalCandidates}건 · 이번 배치 ${r.batch}건`);
      for (const it of r.items) {
        logger.log(`  ${it.eventId} status=${it.status} attempts=${it.attempts} next=${it.nextRetryAt ?? "-"}`);
      }
      logger.log("실행하려면 --execute 를 붙여 다시 실행하세요.");
    } else {
      const r = await svc.execute(new Date(), limit, cap);
      if (r.aborted) {
        logger.error(`EXECUTE 중단: ${r.aborted.reason} — 후보 ${r.aborted.totalCandidates} / 상한 ${r.aborted.cap}.`);
        process.exitCode = 2;
      } else {
        logger.log(
          `EXECUTE — 시도 ${r.attempted} · 성공 ${r.succeeded} · 실패 ${r.failed} · dead ${r.deadLettered} · skip ${r.skipped} · backlog ${r.remainingBacklog} · 누적 dead ${r.totalDead}`,
        );
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  new Logger("subscription-retry").error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
