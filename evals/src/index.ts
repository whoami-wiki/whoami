import 'dotenv/config';
import { resolve } from 'node:path';
import { gradeFixture } from './runner/grade.js';
import { runE2E } from './runner/e2e.js';
import { report, formatPageBreakdown, formatCheckpointBreakdown } from './reporter.js';

const USAGE = `Usage:
  tsx src/index.ts grade <fixture-dir> --page <file> [--rule-based-only] [--vault-path <path>]
  tsx src/index.ts grade <fixture-dir> --pages <dir> [--rule-based-only] [--vault-path <path>]
  tsx src/index.ts grade <fixture-dir> --result <result.json> [--graders <name,...>] [--rule-based-only] [--vault-path <path>]
  tsx src/index.ts run --suite <name> --harness <name> [--model <name>] [--case <id>] [--external-wiki] [--inspect] [--checkpoint-threshold <n>] [--from-result <result.json>]
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
