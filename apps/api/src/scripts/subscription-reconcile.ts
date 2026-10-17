import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { SubscriptionJobsCliModule } from "../modules/subscriptions/subscription-jobs-cli.module";
import {
  SUBSCRIPTION_RECONCILE_DEFAULT_LIMIT,
  SubscriptionReconcileService,
} from "../modules/subscriptions/subscription-reconcile.service";
import { subscriptionJobsDisabled } from "../modules/subscriptions/subscription-retry.service";

// 정기 대사 잡(#165 Slice 3) — 사람/크론이 실행하는 standalone 스크립트.
// 고객을 안정 커서로 순회해 공급자 현재 상태 재조회·반영(사라진 구독 만료는 보류).
// 기본 dry-run(읽기 전용). 실행은 `--execute`. kill-switch: SUBSCRIPTION_JOBS_DISABLED=1.
//   dry-run:  pnpm --filter @clause-lens/api exec tsx src/scripts/subscription-reconcile.ts [--after <cursorId>]
//   execute:  ... src/scripts/subscription-reconcile.ts --execute [--limit N] [--after <cursorId>]
// setInterval·부트훅·HTTP 엔드포인트 금지.

function intArg(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) {
    const n = Number.parseInt(args[i + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}
function strArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const logger = new Logger("subscription-reconcile");
  if (subscriptionJobsDisabled()) {
    logger.warn("SUBSCRIPTION_JOBS_DISABLED — 실행 중단(kill-switch).");
    return;
  }

  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const limit = intArg(args, "--limit", SUBSCRIPTION_RECONCILE_DEFAULT_LIMIT);
  const after = strArg(args, "--after");

  const app = await NestFactory.createApplicationContext(SubscriptionJobsCliModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const svc = app.get(SubscriptionReconcileService);
    if (!execute) {
      const r = await svc.dryRun(limit, after);
      logger.log(`DRY-RUN — 고객 ${r.totalCustomers}명 · 이번 배치 ${r.batch}명 · nextCursor ${r.nextCursor ?? "(끝)"}`);
      logger.log("실행하려면 --execute 를 붙여 다시 실행하세요.");
    } else {
      const r = await svc.execute(limit, after);
      if (r.aborted) {
        logger.error(`EXECUTE 중단: ${r.aborted.reason}`);
        process.exitCode = 2;
      } else {
        logger.log(
          `EXECUTE — 처리 ${r.processed} · 반영 ${r.applied} · noop ${r.noop} · unmapped ${r.unmapped} · 공급자실패 ${r.providerError} · 예외 ${r.errored} · nextCursor ${r.nextCursor ?? "(끝)"}`,
        );
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  new Logger("subscription-reconcile").error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
