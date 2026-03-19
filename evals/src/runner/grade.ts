import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, basename, isAbsolute } from 'node:path';
import type { TestCase, EvalResult, PageResult, PageRole, ContentWeights } from '../types.js';
import { runGraders, computeComposite, type GraderOptions } from '../graders/index.js';

export interface GradeOptions extends GraderOptions {
  /** Path to wikitext file to grade (single page mode). */
  page?: string;
  /** Path to directory of wikitext files (multi-page mode). */
  pages?: string;
  /** Path to a previous result JSON to re-grade. */
  result?: string;
  /** Directory to write results. Defaults to evals/results/. */
  resultsDir?: string;
  /** Path to vault for citation-based accuracy verification. */
  vaultPath?: string;
  /** Run only these graders and merge with existing scores from the previous result. */
  graders?: string[];
}

function loadSourceData(fixtureDir: string, testCase: TestCase): string {
  const sourceParts: string[] = [];

  for (const source of testCase.sources) {
    const sourcePath = isAbsolute(source.path) ? source.path : join(fixtureDir, source.path);
    if (existsSync(sourcePath)) {
      try {
        const content = readFileSync(sourcePath, 'utf-8');
        sourceParts.push(`=== ${source.type} (${source.snapshotId}) ===\n${content}`);
      } catch {
        sourceParts.push(`=== ${source.type} (${source.snapshotId}) ===\n[Could not read]`);
      }
    }
  }

  return sourceParts.join('\n\n');
}

function classifyFile(filename: string): PageRole {
  const name = basename(filename, '.wikitext');
  if (name === 'person') return 'person';
  if (name === 'project') return 'project';
  if (name === 'talk') return 'talk';
  if (name.startsWith('source')) return 'source';
  return 'episode';
}

/**
 * Match a page title against a references map key.
 * Supports exact match and glob-style prefix match (e.g. "Source:Facebook/*").
 */
function matchReferenceKey(pageTitle: string, pattern: string): boolean {
  if (pattern === pageTitle) return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return pageTitle.startsWith(prefix) || pageTitle === prefix.slice(0, -1);
  }
  return false;
}

/**
 * Load reference wikitext for a page from the test case references map
 * or legacy reference field.
 */
function loadReferenceForPage(
  testCase: TestCase,
  fixtureDir: string,
  pageTitle: string,
  role: PageRole,
): string | undefined {
  // 1. Check references map
  if (testCase.references) {
    for (const [pattern, refPath] of Object.entries(testCase.references)) {
      if (matchReferenceKey(pageTitle, pattern)) {
        const absPath = isAbsolute(refPath) ? refPath : join(fixtureDir, refPath);
        try {
          return readFileSync(absPath, 'utf-8');
        } catch {
          return undefined;
        }
      }
    }
  }

  // 2. Backward compat: testCase.reference for person role
  if (role === 'person' && testCase.reference) {
    const refPath = isAbsolute(testCase.reference) ? testCase.reference : join(fixtureDir, testCase.reference);
    try {
      return readFileSync(refPath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  // 3. Implicit reference.wikitext in fixture dir for person role
  if (role === 'person') {
    const implicitPath = join(fixtureDir, 'reference.wikitext');
    if (existsSync(implicitPath)) {
      try {
        return readFileSync(implicitPath, 'utf-8');
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function loadPageFiles(pagesDir: string): { filename: string; role: PageRole; wikitext: string }[] {
  const absDir = resolve(pagesDir);
  const files = readdirSync(absDir).filter((f) => f.endsWith('.wikitext'));
  return files.map((f) => ({
    filename: f,
    role: classifyFile(f),
    wikitext: readFileSync(join(absDir, f), 'utf-8'),
  }));
}

function computeWeightedComposite(pageResults: PageResult[], hasExpectedEpisodes: boolean, weights?: ContentWeights): number {
  const person = pageResults.find((p) => p.role === 'person') ?? pageResults.find((p) => p.role === 'project');
  const episodes = pageResults.filter((p) => p.role === 'episode');
  const talk = pageResults.find((p) => p.role === 'talk');

  let primaryWeight: number;
  let episodeWeight: number;
  let talkWeight: number;

  if (weights) {
    primaryWeight = weights.primary;
    episodeWeight = weights.episodes;
    talkWeight = weights.talk;
  } else if (hasExpectedEpisodes || episodes.length > 0) {
    primaryWeight = 0.5;
    episodeWeight = 0.4;
    talkWeight = 0.1;
  } else {
    primaryWeight = 0.85;
    episodeWeight = 0;
    talkWeight = 0.15;
  }

  if (!talk) {
    primaryWeight += talkWeight;
    talkWeight = 0;
  }

  const primary = person ?? (episodes.length > 0 ? episodes[0] : undefined);
  const extraEpisodes = person ? episodes : episodes.slice(1);

  let weighted = 0;
  if (primary) weighted += primary.composite * primaryWeight;
  if (extraEpisodes.length > 0) {
    const avgEpisode = extraEpisodes.reduce((sum, e) => sum + e.composite, 0) / extraEpisodes.length;
    weighted += avgEpisode * episodeWeight;
  }
  if (talk) weighted += talk.composite * talkWeight;

  return Math.round(weighted * 1000) / 1000;
}

export async function gradeFixture(
  fixtureDir: string,
  options: GradeOptions,
): Promise<EvalResult> {
  const absDir = resolve(fixtureDir);

  // Load test case
  const caseJson = readFileSync(join(absDir, 'case.json'), 'utf-8');
  const testCase: TestCase = JSON.parse(caseJson);

  // Load source data
  const sourceData = loadSourceData(absDir, testCase);

  const subject = testCase.subject ?? testCase.id;
  const vault = options.vaultPath ? { vaultPath: options.vaultPath } : options.vault;

  // Re-grade from previous result JSON
  if (options.result) {
    const prevJson = readFileSync(resolve(options.result), 'utf-8');
    const prev: EvalResult = JSON.parse(prevJson);
    const prevPages = prev.pages ?? [{ title: subject, role: 'person' as PageRole, wikitext: prev.output, scores: [], composite: 0 }];
    const graderFilter = options.graders;
    const pageResults: PageResult[] = [];

    for (const pp of prevPages) {
      const referenceWikitext = loadReferenceForPage(testCase, absDir, pp.title, pp.role);
      const newScores = await runGraders(pp.wikitext, testCase, sourceData, {
        ...options,
        role: pp.role,
        subject,
        expectedEpisodes: testCase.expectedEpisodes,
        referenceWikitext,
        vault,
        log: prev.log,
        graderFilter,
      });

      // When filtering, merge new scores into existing ones from the previous result
      let scores: typeof newScores;
      if (graderFilter) {
        const newGraderNames = new Set(newScores.map((s) => s.grader));
        const kept = pp.scores.filter((s) => !newGraderNames.has(s.grader));
        scores = [...kept, ...newScores];
      } else {
        scores = newScores;
      }

      const composite = computeComposite(scores);
      pageResults.push({ title: pp.title, role: pp.role, wikitext: pp.wikitext, scores, composite });
    }

    const hasExpectedEpisodes = (testCase.expectedEpisodes?.length ?? 0) > 0;
    const primaryPage = pageResults.find((p) => p.role === 'person') ?? pageResults.find((p) => p.role === 'project') ?? pageResults[0];
    const composite = pageResults.length === 1
      ? pageResults[0].composite
      : computeWeightedComposite(pageResults, hasExpectedEpisodes, testCase.weights);

    const result: EvalResult = {
      caseId: testCase.id,
      suite: testCase.suite,
      harness: prev.harness,
      model: prev.model,
      output: primaryPage.wikitext,
      scores: primaryPage.scores,
      composite,
      timestamp: new Date().toISOString(),
      pages: pageResults,
      log: prev.log,
    };

    const resultsDir = options.resultsDir ?? join(absDir, '..', '..', '..', 'results');
    mkdirSync(resultsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const resultPath = join(resultsDir, `${testCase.id}-${ts}.json`);
    writeFileSync(resultPath, JSON.stringify(result, null, 2));

    return result;
  }

  // Multi-page mode
  if (options.pages) {
    const pageFiles = loadPageFiles(options.pages);
    const pageResults: PageResult[] = [];

    for (const pf of pageFiles) {
      const title = basename(pf.filename, '.wikitext');
      const referenceWikitext = loadReferenceForPage(testCase, absDir, title, pf.role);
      const scores = await runGraders(pf.wikitext, testCase, sourceData, {
        ...options,
        role: pf.role,
        subject,
        expectedEpisodes: testCase.expectedEpisodes,
        referenceWikitext,
        vault,
      });
      const composite = computeComposite(scores);
      pageResults.push({ title, role: pf.role, wikitext: pf.wikitext, scores, composite });
    }

    const hasExpectedEpisodes = (testCase.expectedEpisodes?.length ?? 0) > 0;
    const primaryPage = pageResults.find((p) => p.role === 'person') ?? pageResults.find((p) => p.role === 'project') ?? pageResults[0];
    const composite = pageResults.length === 1
      ? pageResults[0].composite
      : computeWeightedComposite(pageResults, hasExpectedEpisodes, testCase.weights);

    const result: EvalResult = {
      caseId: testCase.id,
      suite: testCase.suite,
      harness: 'manual',
      model: 'n/a',
      output: primaryPage.wikitext,
      scores: primaryPage.scores,
      composite,
      timestamp: new Date().toISOString(),
      pages: pageResults,
    };

    const resultsDir = options.resultsDir ?? join(absDir, '..', '..', '..', 'results');
    mkdirSync(resultsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const resultPath = join(resultsDir, `${testCase.id}-${ts}.json`);
    writeFileSync(resultPath, JSON.stringify(result, null, 2));

    return result;
  }

  // Single page mode (backward compatible)
  if (!options.page) {
    throw new Error('Either --page, --pages, or --result is required');
  }

  const wikitext = readFileSync(resolve(options.page), 'utf-8');

  // Try to load reference for single-page mode
  const role = options.role ?? 'person';
  const referenceWikitext = loadReferenceForPage(testCase, absDir, subject, role);

  const scores = await runGraders(wikitext, testCase, sourceData, {
    ...options,
    referenceWikitext,
    vault,
  });
  const composite = computeComposite(scores);

  const result: EvalResult = {
    caseId: testCase.id,
    suite: testCase.suite,
    harness: 'manual',
    model: 'n/a',
    output: wikitext,
    scores,
    composite,
    timestamp: new Date().toISOString(),
  };

  // Write results
  const resultsDir = options.resultsDir ?? join(absDir, '..', '..', '..', 'results');
  mkdirSync(resultsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const resultPath = join(resultsDir, `${testCase.id}-${ts}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));

  return result;
}
