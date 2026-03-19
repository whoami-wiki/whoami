import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { EvalResult, PageResult, CheckpointResult } from './types.js';

interface AggregatedRow {
  harness: string;
  model: string;
  suite: string;
  scores: Record<string, number[]>;
  composites: number[];
}

function loadResults(resultsDir: string): EvalResult[] {
  const files = readdirSync(resultsDir).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const content = readFileSync(join(resultsDir, f), 'utf-8');
    return JSON.parse(content) as EvalResult;
  });
}

function aggregate(results: EvalResult[]): AggregatedRow[] {
  const groups = new Map<string, AggregatedRow>();

  for (const result of results) {
    const key = `${result.harness}|${result.model}|${result.suite}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        harness: result.harness,
        model: result.model,
        suite: result.suite,
        scores: {},
        composites: [],
      };
      groups.set(key, row);
    }

    for (const score of result.scores) {
      if (score.skipped) continue;
      if (!row.scores[score.grader]) row.scores[score.grader] = [];
      row.scores[score.grader].push(score.score);
    }
    row.composites.push(result.composite);
  }

  return [...groups.values()];
}

function avg(nums: number[]): string {
  if (nums.length === 0) return '-';
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return mean.toFixed(2);
}

function formatTable(rows: AggregatedRow[]): string {
  if (rows.length === 0) return 'No results found.';

  // Collect all grader names
  const graderNames = new Set<string>();
  for (const row of rows) {
    for (const name of Object.keys(row.scores)) {
      graderNames.add(name);
    }
  }
  const graders = [...graderNames].sort();

  // Build header
  const headers = ['Harness', 'Model', 'Suite', ...graders.map(capitalize), 'Composite'];
  const separator = headers.map((h) => '-'.repeat(Math.max(h.length, 6)));

  const lines: string[] = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + separator.join(' | ') + ' |');

  for (const row of rows) {
    const cells = [
      row.harness,
      row.model,
      row.suite,
      ...graders.map((g) => avg(row.scores[g] ?? [])),
      avg(row.composites),
    ];
    lines.push('| ' + cells.join(' | ') + ' |');
  }

  return lines.join('\n');
}

function formatDurationShort(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m${remainSecs > 0 ? `${remainSecs}s` : ''}`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h${remainMins > 0 ? `${remainMins}m` : ''}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatPageBreakdown(pages: PageResult[]): string {
  const lines: string[] = [];
  for (const page of pages) {
    lines.push(`  [${page.role}] ${page.title}: ${page.composite.toFixed(3)}`);
    for (const score of page.scores) {
      const status = score.skipped ? ' (skipped)' : '';
      lines.push(`    ${score.grader}: ${score.score.toFixed(3)}${status}`);
      for (const d of score.details) {
        const icon = d.passed ? '+' : '-';
        const note = d.note ? ` (${d.note})` : '';
        lines.push(`      [${icon}] ${d.check}${note}`);
      }
    }
  }
  return lines.join('\n');
}

export function formatCheckpointBreakdown(checkpoints: CheckpointResult[]): string {
  const lines: string[] = [];

  // Show score progression bar when there are more than 2 checkpoints
  if (checkpoints.length > 2) {
    lines.push('  Score progression:');
    const maxIdLen = Math.max(...checkpoints.map((cp) => cp.stage.length));
    const barWidth = 20;
    for (const cp of checkpoints) {
      const filled = Math.round(cp.composite * barWidth);
      const bar = '#'.repeat(filled) + '.'.repeat(barWidth - filled);
      const idx = String(cp.checkpoint).padStart(2, ' ');
      const stage = cp.stage.padEnd(maxIdLen, ' ');
      const dur = cp.durationMs != null ? `  ${formatDurationShort(cp.durationMs)}` : '';
      lines.push(`    ${idx}. ${stage}  [${bar}] ${cp.composite.toFixed(3)}${dur}`);
    }
    lines.push('');
  }

  for (const cp of checkpoints) {
    const status = cp.passed ? 'PASS' : 'FAIL';
    const dur = cp.durationMs != null ? ` (${formatDurationShort(cp.durationMs)})` : '';
    lines.push(`  Checkpoint ${cp.checkpoint} (${cp.stage}): ${cp.composite.toFixed(3)} [${status}] (threshold: ${cp.threshold})${dur}`);
    for (const page of cp.pages) {
      lines.push(`    [${page.role}] ${page.title}: ${page.composite.toFixed(3)}`);
      for (const score of page.scores) {
        const skipNote = score.skipped ? ' (skipped)' : '';
        lines.push(`      ${score.grader}: ${score.score.toFixed(3)}${skipNote}`);
      }
    }
  }
  return lines.join('\n');
}

export function formatJson(resultsDir: string): string {
  const results = loadResults(resultsDir);
  const rows = aggregate(results);
  return JSON.stringify(rows, null, 2);
}

export function formatMarkdown(resultsDir: string): string {
  const results = loadResults(resultsDir);

  // Group by suite
  const bySuite = new Map<string, EvalResult[]>();
  for (const r of results) {
    const list = bySuite.get(r.suite) ?? [];
    list.push(r);
    bySuite.set(r.suite, list);
  }

  const parts: string[] = [];
  for (const [suite, suiteResults] of bySuite) {
    parts.push(`## ${capitalize(suite)}\n`);
    const rows = aggregate(suiteResults);
    parts.push(formatTable(rows));
    parts.push('');
  }

  return parts.join('\n');
}

export function report(resultsDir: string, format: 'json' | 'markdown' = 'markdown'): string {
  if (format === 'json') {
    return formatJson(resultsDir);
  }
  return formatMarkdown(resultsDir);
}
