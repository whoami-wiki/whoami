import 'dotenv/config';
import { resolve } from 'node:path';
import { gradeFixture } from './runner/grade.js';
import { runE2E, runBatch } from './runner/e2e.js';
import type { BatchOutcome } from './runner/e2e.js';
import { report, formatPageBreakdown, formatCheckpointBreakdown } from './reporter.js';

const USAGE = `Usage:
  tsx src/index.ts grade <fixture-dir> --page <file> [--rule-based-only] [--vault-path <path>]
  tsx src/index.ts grade <fixture-dir> --pages <dir> [--rule-based-only] [--vault-path <path>]
  tsx src/index.ts grade <fixture-dir> --result <result.json> [--graders <name,...>] [--rule-based-only] [--vault-path <path>]
  tsx src/index.ts run --suite <name> --harness <name> [--model <name>] [--case <id>] [--external-wiki] [--inspect] [--checkpoint-threshold <n>] [--from-result <result.json>]
  tsx src/index.ts batch --suite <name> --runs <harness:model,...> [--case <id>] [--jobs <n>] [--checkpoint-threshold <n>] [--from-result <result.json>]
  tsx src/index.ts report [results-dir]`;

function parseArgs(args: string[]): { command: string; positional: string[]; flags: Record<string, string> } {
  const command = args[0] ?? '';
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function printScores(result: { scores: { grader: string; score: number; skipped?: boolean; details: { check: string; passed: boolean; penalty: number; note?: string }[] }[]; composite: number; pages?: import('./types.js').PageResult[]; checkpoints?: import('./types.js').CheckpointResult[] }): void {
  console.log('\n=== Grading Results ===\n');

  // Show checkpoint breakdown if available
  if (result.checkpoints && result.checkpoints.length > 0) {
    console.log('--- Checkpoint breakdown ---\n');
    console.log(formatCheckpointBreakdown(result.checkpoints));
    console.log();
  }

  // Show per-page breakdown if available
  if (result.pages && result.pages.length > 1) {
    console.log('--- Per-page breakdown ---\n');
    console.log(formatPageBreakdown(result.pages));
    console.log('\n--- Primary page scores ---\n');
  }

  for (const score of result.scores) {
    const status = score.skipped ? ' (skipped)' : '';
    console.log(`${score.grader}: ${score.score.toFixed(3)}${status}`);
    for (const d of score.details) {
      const icon = d.passed ? '+' : '-';
      const note = d.note ? ` (${d.note})` : '';
      console.log(`  [${icon}] ${d.check}${note}`);
    }
    console.log();
  }

  console.log(`Composite: ${result.composite.toFixed(3)}`);
}

function formatBatchDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m${remainSecs > 0 ? ` ${remainSecs}s` : ''}`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h${remainMins > 0 ? ` ${remainMins}m` : ''}`;
}

function printBatchSummary(outcomes: BatchOutcome[]): void {
  console.log('\n=== Batch Summary ===\n');

  const harnessWidth = Math.max(7, ...outcomes.map((o) => o.spec.harness.length));
  const modelWidth = Math.max(5, ...outcomes.map((o) => (o.spec.model ?? 'default').length));

  const header = `${'Harness'.padEnd(harnessWidth)}  ${'Model'.padEnd(modelWidth)}  ${'Composite'.padEnd(9)}  ${'Duration'.padEnd(8)}  Status`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const o of outcomes) {
    const harness = o.spec.harness.padEnd(harnessWidth);
    const model = (o.spec.model ?? 'default').padEnd(modelWidth);
    const duration = formatBatchDuration(o.durationMs).padEnd(8);

    if (o.error) {
      console.log(`${harness}  ${model}  ${'—'.padEnd(9)}  ${duration}  FAILED: ${o.error.slice(0, 60)}`);
    } else if (o.results.length === 0) {
      console.log(`${harness}  ${model}  ${'—'.padEnd(9)}  ${duration}  NO RESULTS`);
    } else {
      for (const r of o.results) {
        const comp = r.composite.toFixed(3).padEnd(9);
        console.log(`${harness}  ${model}  ${comp}  ${duration}  OK`);
      }
    }
  }

  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(USAGE);
    process.exit(1);
  }

  const { command, positional, flags } = parseArgs(args);

  switch (command) {
    case 'grade': {
      const fixtureDir = positional[0];
      const page = flags['page'];
      const pages = flags['pages'];
      const resultFile = flags['result'];
      if (!fixtureDir || (!page && !pages && !resultFile)) {
        console.error('Error: fixture directory and --page, --pages, or --result are required');
        console.log(USAGE);
        process.exit(1);
      }

      const graders = flags['graders'] ? flags['graders'].split(',').map((s) => s.trim()) : undefined;

      const result = await gradeFixture(resolve(fixtureDir), {
        page,
        pages,
        result: resultFile,
        ruleBasedOnly: flags['rule-based-only'] === 'true',
        vaultPath: flags['vault-path'],
        graders,
      });

      printScores(result);
      break;
    }

    case 'run': {
      const suite = flags['suite'];
      const harness = flags['harness'];
      if (!suite || !harness) {
        console.error('Error: --suite and --harness are required');
        console.log(USAGE);
        process.exit(1);
      }

      const thresholdStr = flags['checkpoint-threshold'];
      const checkpointThreshold = thresholdStr ? parseFloat(thresholdStr) : undefined;

      const results = await runE2E({
        suite,
        harness,
        model: flags['model'],
        caseFilter: flags['case'],
        externalWiki: flags['external-wiki'] === 'true',
        inspect: flags['inspect'] === 'true',
        checkpointThreshold,
        fromResult: flags['from-result'],
      });

      console.log(`\nCompleted ${results.length} test case(s)`);
      for (const r of results) {
        printScores(r);
      }
      break;
    }

    case 'batch': {
      const suite = flags['suite'];
      const runsRaw = flags['runs'];
      if (!suite || !runsRaw) {
        console.error('Error: --suite and --runs are required');
        console.error('  --runs format: harness:model,harness:model,...  (model is optional)');
        console.log(USAGE);
        process.exit(1);
      }

      const runs = runsRaw.split(',').map((s) => {
        const trimmed = s.trim();
        const colon = trimmed.indexOf(':');
        if (colon === -1) return { harness: trimmed };
        return { harness: trimmed.slice(0, colon), model: trimmed.slice(colon + 1) };
      });

      const jobsStr = flags['jobs'];
      const jobs = jobsStr ? parseInt(jobsStr, 10) : undefined;

      const batchThresholdStr = flags['checkpoint-threshold'];
      const batchThreshold = batchThresholdStr ? parseFloat(batchThresholdStr) : undefined;

      console.log(`\nStarting batch: ${runs.length} run(s)${jobs ? `, ${jobs} parallel` : ', all parallel'}`);
      for (const r of runs) {
        console.log(`  ${r.harness}${r.model ? `:${r.model}` : ''}`);
      }
      console.log();

      const outcomes = await runBatch({
        suite,
        runs,
        caseFilter: flags['case'],
        checkpointThreshold: batchThreshold,
        fromResult: flags['from-result'],
        jobs,
      });

      printBatchSummary(outcomes);
      break;
    }

    case 'report': {
      const resultsDir = positional[0] ?? 'results';
      const output = report(resolve(resultsDir));
      console.log(output);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
