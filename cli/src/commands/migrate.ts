import type { ApiClient, MigrateReport } from '../api-client.js';
import { ApiError } from '../api-client.js';

/** Inputs for the migrate command runner — exposed for testing. */
export interface MigrateRunnerCli {
  client: Pick<ApiClient, 'migrate'>;
  write: (s: string) => void;
  page?: string;
  dryRun: boolean;
  force: boolean;
  json: boolean;
}

/**
 * Run the migrate CLI subcommand. Returns the desired process exit
 * code: 0 on success, 2 on per-page failures, 3 on dirty-repo refusal.
 */
export async function runMigrate(opts: MigrateRunnerCli): Promise<number> {
  let report: MigrateReport;
  try {
    report = await opts.client.migrate({
      page: opts.page,
      dryRun: opts.dryRun,
      force: opts.force,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.detail?.includes('dirty-repo')) {
      opts.write(`error: data repo has uncommitted changes — commit, stash, or rerun with --force\n`);
      return 3;
    }
    if (err instanceof ApiError) {
      opts.write(`error: ${err.message}\n`);
      return 2;
    }
    opts.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  if (opts.json) {
    opts.write(JSON.stringify(report));
    return report.failed.length > 0 ? 2 : 0;
  }

  opts.write(
    `walked ${report.walked}, migrated ${report.migrated.length}, skipped ${report.skipped.length}, failed ${report.failed.length}\n`,
  );
  for (const m of report.migrated) {
    opts.write(`  migrated ${m.slug} v${m.from} → v${m.to}\n`);
  }
  for (const f of report.failed) {
    opts.write(`  failed   ${f.slug}: ${f.error}\n`);
  }
  return report.failed.length > 0 ? 2 : 0;
}
