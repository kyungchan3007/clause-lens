import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { RetentionCliModule } from "../modules/retention/retention-cli.module";
import {
  RETENTION_SWEEP_DEFAULT_LIMIT,
  RETENTION_SWEEP_DEFAULT_MAX_CANDIDATES,
  RetentionSweepService,
} from "../modules/retention/retention-sweep.service";

// 보관 만료 실삭제 잡(#164) — 사람이 수동 실행하는 standalone 스크립트.
// 기본 dry-run(쓰기 없음). 실삭제는 `--execute` 명시. kill-switch: RETENTION_SWEEP_DISABLED=1.
//   dry-run:  pnpm --filter @clause-lens/api exec tsx src/scripts/retention-sweep.ts
//   execute:  ... src/scripts/retention-sweep.ts --execute [--limit N] [--max N]
// setInterval·부트훅·HTTP 엔드포인트 금지(무인 대량삭제 방지, 적대적 리뷰 C6).

function intArg(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) {
    const n = Number.parseInt(args[i + 1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

async function main(): Promise<void> {
  const logger = new Logger("retention-sweep");
  const disabled = process.env.RETENTION_SWEEP_DISABLED;
  if (disabled === "1" || disabled === "true") {
    logger.warn("RETENTION_SWEEP_DISABLED 설정됨 — 실행 중단(kill-switch).");
    return;
  }

  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const limit = intArg(args, "--limit", RETENTION_SWEEP_DEFAULT_LIMIT);
  const cap = intArg(args, "--max", RETENTION_SWEEP_DEFAULT_MAX_CANDIDATES);

  const app = await NestFactory.createApplicationContext(RetentionCliModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const svc = app.get(RetentionSweepService);
    if (!execute) {
      const r = await svc.dryRun(limit);
      logger.log(`DRY-RUN — 후보 ${r.totalCandidates}건 · 이번 배치 ${r.batch}건`);
      for (const p of r.plans) {
        logger.log(`  ${p.documentId} (user ${p.userId}) pages=${p.pageCount} keys=${p.keys.length}`);
      }
      logger.log("실삭제하려면 --execute 를 붙여 다시 실행하세요.");
    } else {
      const r = await svc.execute(limit, cap);
      if (r.aborted) {
        logger.error(
          `EXECUTE 중단: ${r.aborted.reason} — 후보 ${r.aborted.totalCandidates} > 상한 ${r.aborted.cap}. dry-run으로 확인하세요.`,
        );
        process.exitCode = 2;
      } else {
        logger.log(`EXECUTE — 삭제 ${r.deleted} · 실패 ${r.failed} · skip ${r.skipped} (후보 ${r.totalCandidates})`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  new Logger("retention-sweep").error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
