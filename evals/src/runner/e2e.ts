import { readFileSync, readdirSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve, isAbsolute } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { TestCase, EvalResult, PageResult, PageRole, CheckpointResult, CheckpointSpec, GradeTarget, ContentWeights } from '../types.js';
import type { Harness } from '../harnesses/types.js';
import { runGraders, computeComposite } from '../graders/index.js';
import type { CitationManifest } from '../graders/accuracy.js';
import { createClaudeCodeHarness } from '../harnesses/claude-code.js';
import { createCodexHarness } from '../harnesses/codex.js';
import { createOpenCodeHarness } from '../harnesses/opencode.js';
import { startWiki, writePageDirect, type WikiInstance } from '../wiki.js';

export interface E2EOptions {
  suite: string;
  harness: string;
  model?: string;
  /** Run only the test case with this ID */
  caseFilter?: string;
  /** Use an already-running wiki instead of spinning up an isolated instance */
  externalWiki?: boolean;
  /** Pause after grading so you can inspect the wiki before teardown */
  inspect?: boolean;
  fixturesDir?: string;
  resultsDir?: string;
  /** Override checkpoint threshold from case.json */
  checkpointThreshold?: number;
  /** Path to a previous result JSON — reuses checkpoint 1 source pages, skips Phase 1 */
  fromResult?: string;
}

interface DiscoveredPage {
  title: string;
  role: PageRole;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m${remainSecs > 0 ? ` ${remainSecs}s` : ''}`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h${remainMins > 0 ? ` ${remainMins}m` : ''}`;
}

function getHarness(name: string, model?: string): Harness {
  switch (name) {
    case 'claude-code':
      return createClaudeCodeHarness(model);
    case 'codex':
      return createCodexHarness(model);
    case 'opencode':
      return createOpenCodeHarness(model);
    default:
      throw new Error(`Unknown harness: ${name}`);
  }
}

function loadTestCases(fixturesDir: string, suite: string): { testCase: TestCase; dir: string }[] {
  const suiteDir = join(fixturesDir, suite);
  const entries = readdirSync(suiteDir, { withFileTypes: true });
  const cases: { testCase: TestCase; dir: string }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const caseDir = join(suiteDir, entry.name);
    try {
      const caseJson = readFileSync(join(caseDir, 'case.json'), 'utf-8');
      cases.push({ testCase: JSON.parse(caseJson), dir: caseDir });
    } catch {
      // Skip directories without case.json
    }
  }

  return cases;
}

interface Logger {
  log(msg: string): void;
  error(msg: string): void;
  path: string;
}

function createLogger(resultsDir: string): Logger {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = join(resultsDir, `run-${ts}.log`);
  const write = (level: string, msg: string) => {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
    process.stderr.write(line);
    appendFileSync(logPath, line);
  };
  return {
    log: (msg: string) => write('INFO', msg),
    error: (msg: string) => write('ERROR', msg),
    path: logPath,
  };
}

function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

function execWai(args: string, env: Record<string, string | undefined>): string {
  return execSync(`wai ${args}`, { env, encoding: 'utf-8' });
}


function readManifest(
  log: Logger,
  harnessCwd?: string,
): CitationManifest | undefined {
  if (!harnessCwd) {
    log.log('No harness cwd — cannot read citation manifest');
    return undefined;
  }

  const candidatePaths = [
    join(harnessCwd, 'citation-manifest.json'),
    join(harnessCwd, 'Citation-manifest.json'),
  ];

  for (const filePath of candidatePaths) {
    try {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8');
        const manifest = JSON.parse(raw) as CitationManifest;
        if (manifest.claims && manifest.claims.length > 0) {
          log.log(`Read citation manifest from ${filePath}: ${manifest.claims.length} claims`);
          return manifest;
        }
      }
    } catch {
      // Not valid JSON, try next
    }
  }

  log.log('No citation manifest found on filesystem');
  return undefined;
}

function readWikiPage(pageTitle: string, env: Record<string, string | undefined>): string {
  return execWai(`read "${pageTitle}" --raw`, env);
}

function writeWikiPage(pageTitle: string, wikitext: string, env: Record<string, string | undefined>): void {
  try {
    execSync(`wai write "${pageTitle}" -`, { env, encoding: 'utf-8', input: wikitext, timeout: 120_000 });
  } catch (err: unknown) {
    // wai write exits 1 when content is identical ("No changes") — ignore that
    const stderr = (err as { stderr?: string }).stderr ?? '';
    if (!stderr.includes('No changes')) throw err;
  }
}

function restoreSourcePages(
  resultPath: string,
  env: Record<string, string | undefined>,
  log: Logger,
): CheckpointResult {
  const raw = readFileSync(resultPath, 'utf-8');
  const prev: EvalResult = JSON.parse(raw);

  const cp1 = prev.checkpoints?.find((c) => c.checkpoint === 1);
  if (!cp1 || !cp1.passed) {
    throw new Error('Previous result has no passing checkpoint 1');
  }

  const dataPath = env['WIKI_DATA_PATH'];
  const confPath = dataPath ? join(dataPath, 'LocalSettings.php') : undefined;
  for (const page of cp1.pages) {
    log.log(`Restoring "${page.title}" (${page.wikitext.length} chars)`);
    if (confPath) {
      writePageDirect(confPath, page.title, page.wikitext);
    } else {
      writeWikiPage(page.title, page.wikitext, env);
    }
  }

  return cp1;
}

function discoverAllPages(env: Record<string, string | undefined>): { title: string; ns: number }[] {
  let changesJson: string;
  try {
    changesJson = execWai('changes -n 200 --json', env);
  } catch {
    return [];
  }
  try {
    return JSON.parse(changesJson);
  } catch {
    return [];
  }
}

function discoverSourcePages(env: Record<string, string | undefined>): DiscoveredPage[] {
  const changes = discoverAllPages(env);
  const seen = new Set<string>();
  const pages: DiscoveredPage[] = [];

  for (const change of changes) {
    if (seen.has(change.title)) continue;
    seen.add(change.title);

    if (/^Source:/i.test(change.title)) {
      pages.push({ title: change.title, role: 'source' });
    }
  }

  return pages;
}

function discoverContentPages(env: Record<string, string | undefined>, subject: string): DiscoveredPage[] {
  const changes = discoverAllPages(env);
  const seen = new Set<string>();
  const pages: DiscoveredPage[] = [];

  for (const change of changes) {
    if (seen.has(change.title)) continue;
    seen.add(change.title);

    // Skip Source:, Task:, and default Main Page
    if (/^(Source|Task):/i.test(change.title)) continue;
    if (change.title === 'Main Page') continue;

    // Talk namespace
    if (/^Talk:/i.test(change.title) || change.ns === 1) {
      pages.push({ title: change.title, role: 'talk' });
      continue;
    }

    // Main namespace — classify as person or episode
    if (change.ns === 0 || !change.title.includes(':')) {
      const role: PageRole = change.title === subject ? 'person' : 'episode';
      pages.push({ title: change.title, role });
    }
  }

  return pages;
}

/**
 * Discover wiki pages that match a set of GradeTarget patterns.
 * Uses the existing matchReferenceKey helper for glob matching.
 *
 * When a non-glob content target (person, episode, talk) has no exact match,
 * falls back to matching any main-namespace page whose title contains the
 * pattern text (case-insensitive). This handles agents that choose a different
 * but related page title (e.g. "Mexico City, March 2022" vs "CDMX trip").
 */
function discoverPagesForTargets(
  targets: GradeTarget[],
  env: Record<string, string | undefined>,
): DiscoveredPage[] {
  const changes = discoverAllPages(env);
  const seen = new Set<string>();
  const pages: DiscoveredPage[] = [];

  // First pass: exact/glob matching
  for (const change of changes) {
    if (seen.has(change.title)) continue;
    if (change.title === 'Main Page') continue;

    for (const target of targets) {
      if (matchReferenceKey(change.title, target.pattern)) {
        seen.add(change.title);
        pages.push({ title: change.title, role: target.role });
        break;
      }
    }
  }

  // Second pass: fuzzy fallback for unmatched content targets.
  // For each target that found no match and isn't a glob pattern,
  // look for any non-source page in the wiki that could be the intended page.
  const matchedRoles = new Set(pages.map((p) => p.role));
  for (const target of targets) {
    // Skip source targets and glob patterns — those should match exactly
    if (target.role === 'source') continue;
    if (target.pattern.includes('*')) continue;
    // Skip if this target already matched
    if (pages.some((p) => matchReferenceKey(p.title, target.pattern))) continue;

    // Find candidate pages in the right namespace
    const isTalk = target.pattern.startsWith('Talk:');
    for (const change of changes) {
      if (seen.has(change.title)) continue;
      if (change.title === 'Main Page') continue;
      if (/^(Source|Task):/i.test(change.title)) continue;

      const pageIsTalk = /^Talk:/i.test(change.title);
      if (isTalk !== pageIsTalk) continue;

      // Accept the first non-source page in the matching namespace
      seen.add(change.title);
      pages.push({ title: change.title, role: target.role });
      break;
    }
  }

  return pages;
}

/**
 * Match a page title against a references map key.
 * Supports exact match and glob-style prefix match (e.g. "Source:Facebook/*").
 */
function matchReferenceKey(pageTitle: string, pattern: string): boolean {
  if (pattern === pageTitle) return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1); // "Source:Facebook/"
    return pageTitle.startsWith(prefix) || pageTitle === prefix.slice(0, -1);
  }
  // Bare glob: "Source:*" matches anything starting with "Source:"
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -1); // "Source:"
    return pageTitle.startsWith(prefix);
  }
  return false;
}

/**
 * Load reference wikitext for a page given the test case references map.
 *
 * Resolution order:
 * 1. testCase.references map (exact match, then glob prefix match)
 * 2. testCase.reference field for person role (backward compat)
 * 3. Implicit reference.wikitext in fixture dir for person role
 */
function loadReferenceWikitext(
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

  // 2. Backward compat: testCase.reference field for person role
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

  // If no talk page, redistribute to primary
  if (!talk) {
    primaryWeight += talkWeight;
    talkWeight = 0;
  }

  // Primary page is person/project if it exists, otherwise the first episode
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

function configureWaiCredentials(wiki: WikiInstance): void {
  const configDir = join(homedir(), '.whoami');
  mkdirSync(configDir, { recursive: true });

  const credPath = join(configDir, 'credentials.json');
  const credentials = JSON.stringify({
    server: wiki.url,
    username: wiki.username,
    password: wiki.password,
  }, null, 2);
  writeFileSync(credPath, credentials + '\n', { mode: 0o600 });
}

async function gradePages(
  pages: DiscoveredPage[],
  testCase: TestCase,
  fixtureDir: string,
  sourceData: string,
  subject: string,
  env: Record<string, string | undefined>,
  log: Logger,
  harnessLog?: string,
  manifest?: CitationManifest,
  previousWikitextMap?: Map<string, string>,
  checkpointId?: string,
  skipReference?: boolean,
): Promise<PageResult[]> {
  // Pass 1: Read all pages so talk page content is available for integration grading
  const pageContents = new Map<string, string>();
  for (const page of pages) {
    log.log(`Reading page "${page.title}"`);
    try {
      const wikitext = readWikiPage(page.title, env);
      log.log(`Read OK (${wikitext.length} chars)`);
      pageContents.set(page.title, wikitext);
    } catch (err) {
      log.error(`Could not read page "${page.title}": ${err}`);
    }
  }

  // Find talk page wikitext (for integration grading of person/episode pages)
  const talkPage = pages.find((p) => p.role === 'talk');
  const talkWikitext = talkPage ? pageContents.get(talkPage.title) : undefined;

  // Pass 2: Grade all pages
  const pageResults: PageResult[] = [];

  for (const page of pages) {
    const wikitext = pageContents.get(page.title);
    if (!wikitext) continue;

    const referenceWikitext = skipReference
      ? undefined
      : loadReferenceWikitext(testCase, fixtureDir, page.title, page.role);
    if (referenceWikitext) {
      log.log(`Loaded reference for "${page.title}" (${referenceWikitext.length} chars)`);
    }

    const previousWikitext = previousWikitextMap?.get(page.title);

    const vaultPath = env['WAI_VAULT_PATH'];
    log.log(`Grading ${page.role} page "${page.title}"`);
    try {
      const scores = await runGraders(wikitext, testCase, sourceData, {
        role: page.role,
        subject,
        expectedEpisodes: testCase.expectedEpisodes,
        referenceWikitext,
        vault: vaultPath ? { vaultPath } : undefined,
        log: harnessLog,
        manifest,
        previousWikitext,
        checkpointId,
        skipReference,
        talkWikitext: (page.role === 'person' || page.role === 'project' || page.role === 'episode') ? talkWikitext : undefined,
      });
      const composite = computeComposite(scores);
      log.log(`${page.role} "${page.title}" → ${composite.toFixed(3)}`);

      pageResults.push({
        title: page.title,
        role: page.role,
        wikitext,
        scores,
        composite,
      });
    } catch (err) {
      log.error(`Grading failed for ${page.role} page "${page.title}": ${err}`);
      // Record the page with zero score so the run can continue
      pageResults.push({
        title: page.title,
        role: page.role,
        wikitext,
        scores: [],
        composite: 0,
      });
    }
  }

  return pageResults;
}

/**
 * Run the incremental checkpoint loop for a test case with CheckpointSpec[].
 * Each checkpoint: snapshot new sources → invoke harness → discover & grade target pages → gate.
 */
async function runCheckpointLoop(
  testCase: TestCase,
  dir: string,
  harness: Harness,
  env: Record<string, string | undefined>,
  options: E2EOptions,
  log: Logger,
): Promise<{ checkpoints: CheckpointResult[]; allPageResults: PageResult[]; harnessLogs: string[]; resolvedModel?: string }> {
  const specs = testCase.checkpoints!;
  const checkpoints: CheckpointResult[] = [];
  const latestPageScores = new Map<string, PageResult>();
  const priorPageTitles: string[] = [];
  const harnessLogs: string[] = [];
  let resolvedModel: string | undefined;
  let manifest: CitationManifest | undefined;
  let harnessSessionId: string | undefined;
  let harnessCwd: string | undefined;

  const subject = testCase.subject ?? testCase.id;

  // fromResult support: restore all passing checkpoints from a previous result
  let startIndex = 0;
  if (options.fromResult) {
    const raw = readFileSync(options.fromResult, 'utf-8');
    const prev: EvalResult = JSON.parse(raw);

    if (prev.checkpoints) {
      // Collect latest version of each page across all passing checkpoints
      const pagesToRestore = new Map<string, { page: PageResult }>();
      for (const cp of prev.checkpoints) {
        if (!cp.passed) break;
        checkpoints.push(cp);
        for (const page of cp.pages) {
          pagesToRestore.set(page.title, { page });
          latestPageScores.set(page.title, page);
          if (!priorPageTitles.includes(page.title)) {
            priorPageTitles.push(page.title);
          }
        }
        startIndex++;
      }

      // Write only the latest version of each page (avoids duplicate writes)
      // Use PHP CLI directly when available (faster, no HTTP timeout issues)
      const dataPath = env['WIKI_DATA_PATH'];
      const confPath = dataPath ? join(dataPath, 'LocalSettings.php') : undefined;
      for (const [title, { page }] of pagesToRestore) {
        log.log(`Restoring "${title}" (${page.wikitext.length} chars)`);
        if (confPath) {
          writePageDirect(confPath, title, page.wikitext);
        } else {
          writeWikiPage(title, page.wikitext, env);
        }
      }
      log.log(`Restored ${startIndex} passing checkpoint(s) (${pagesToRestore.size} unique pages) from previous result`);

      // Snapshot all sources introduced up to the restored point
      // so the vault is populated for the accuracy grader
      for (let i = 0; i < startIndex; i++) {
        const cpSources = specs[i].sources ?? [];
        for (const source of cpSources) {
          const sourcePath = isAbsolute(source.path) ? source.path : join(dir, source.path);
          log.log(`Snapshotting ${sourcePath} into vault`);
          try {
            execWai(`snapshot "${sourcePath}"`, env);
          } catch (err) {
            log.error(`Snapshot failed for ${sourcePath}: ${err}`);
          }
        }
      }
    }
  }

  for (let i = startIndex; i < specs.length; i++) {
    const spec = specs[i];
    const cpStart = Date.now();
    log.log(`--- Checkpoint ${i + 1}/${specs.length}: ${spec.id} ---`);

    // Snapshot current wikitext of pages that will be graded (for integration grading)
    const previousWikitextMap = new Map<string, string>();
    const targetPagesPreSnapshot = discoverPagesForTargets(spec.grade, env);
    for (const page of targetPagesPreSnapshot) {
      try {
        const wikitext = readWikiPage(page.title, env);
        if (wikitext.trim().length > 0) {
          previousWikitextMap.set(page.title, wikitext);
        }
      } catch {
        // Page doesn't exist yet — no previous wikitext
      }
    }
    // Also include any pages from latestPageScores that match grade targets
    for (const [title, pr] of latestPageScores) {
      if (!previousWikitextMap.has(title)) {
        previousWikitextMap.set(title, pr.wikitext);
      }
    }

    // Load owner anecdotes if specified
    let ownerInput: unknown[] | undefined;
    if (spec.ownerInput) {
      try {
        const ownerPath = join(dir, spec.ownerInput);
        const ownerJson = readFileSync(ownerPath, 'utf-8');
        const parsed = JSON.parse(ownerJson);
        ownerInput = parsed.entries ?? [];
        log.log(`Loaded ${(ownerInput as unknown[]).length} owner anecdote(s) from ${spec.ownerInput}`);
      } catch (err) {
        log.error(`Failed to load owner anecdotes from ${spec.ownerInput}: ${err}`);
      }
    }

    // Invoke harness (the agent handles snapshotting via `wai snapshot`)
    log.log(`Invoking harness (${spec.id}) — ${harness.name}${harnessSessionId ? ` (resuming ${harnessSessionId.slice(0, 8)}…)` : ''}`);
    try {
      const result = await harness.run(testCase, env, {
        checkpoint: spec,
        checkpointIndex: i,
        priorPages: [...priorPageTitles],
        sessionId: harnessSessionId,
        cwd: harnessCwd,
        ownerInput,
      });
      if (result.log) harnessLogs.push(result.log);
      if (result.model) resolvedModel = result.model;
      if (result.sessionId) harnessSessionId = result.sessionId;
      if (result.cwd) harnessCwd = result.cwd;
      log.log(`Harness finished for checkpoint ${spec.id}`);
    } catch (err) {
      log.error(`Harness failed for checkpoint ${spec.id}: ${err}`);
      // Record a zero-score checkpoint and stop
      checkpoints.push({
        checkpoint: i + 1,
        stage: spec.id,
        pages: [],
        composite: 0,
        passed: false,
        threshold: spec.threshold ?? 0,
        durationMs: Date.now() - cpStart,
      });
      break;
    }

    // Read citation manifest if this is the verify checkpoint
    if (spec.id === 'verify' || spec.produceManifest) {
      manifest = readManifest(log, harnessCwd);
    }

    // Discover and grade target pages
    const targetPages = discoverPagesForTargets(spec.grade, env);
    log.log(`Discovered ${targetPages.length} page(s) for checkpoint ${spec.id}: ${targetPages.map((p) => p.title).join(', ') || '(none)'}`);

    if (targetPages.length === 0 && spec.grade.length > 0) {
      log.log(`WARNING: checkpoint ${spec.id} expected pages matching ${spec.grade.map((g) => g.pattern).join(', ')} but found none`);
    }

    const pageResults = await gradePages(
      targetPages,
      testCase,
      dir,
      '',
      subject,
      env,
      log,
      harnessLogs.join('\n'),
      manifest,
      previousWikitextMap,
      spec.id,
      spec.skipReference,
    );

    // Update latest scores map
    for (const pr of pageResults) {
      latestPageScores.set(pr.title, pr);
      if (!priorPageTitles.includes(pr.title)) {
        priorPageTitles.push(pr.title);
      }
    }

    // Compute checkpoint composite (average of graded pages)
    const cpComposite = pageResults.length > 0
      ? Math.round((pageResults.reduce((sum, p) => sum + p.composite, 0) / pageResults.length) * 1000) / 1000
      : 0;

    const threshold = spec.threshold ?? 0;
    const passed = threshold === 0 || cpComposite >= threshold;

    const cpDuration = Date.now() - cpStart;
    checkpoints.push({
      checkpoint: i + 1,
      stage: spec.id,
      pages: pageResults,
      composite: cpComposite,
      passed,
      threshold,
      durationMs: cpDuration,
    });

    log.log(`Checkpoint ${i + 1} (${spec.id}): ${cpComposite.toFixed(3)}${threshold > 0 ? ` ${passed ? '>=' : '<'} ${threshold}` : ''} → ${passed ? 'PASS' : 'FAIL'} (${formatDuration(cpDuration)})`);

    if (!passed) {
      log.log(`Stopping — checkpoint ${spec.id} below threshold`);
      break;
    }
  }

  // Collect the latest version of all graded pages
  const allPageResults = [...latestPageScores.values()];

  return { checkpoints, allPageResults, harnessLogs, resolvedModel };
}

async function runCases(
  cases: { testCase: TestCase; dir: string }[],
  harness: Harness,
  env: Record<string, string | undefined>,
  options: E2EOptions,
  resultsDir: string,
  log: Logger,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];

  for (const { testCase, dir } of cases) {
    const caseStart = Date.now();
    log.log(`=== Case ${testCase.id}: ${testCase.description} ===`);

    // Step 1: Create task
    let taskId: string;
    log.log('Creating task');
    try {
      const taskOutput = execWai(`task create -m "${testCase.description}"`, env);
      const idMatch = taskOutput.match(/(\d{4})/);
      taskId = idMatch ? idMatch[1] : 'unknown';
      log.log(`Task created: ${taskId}`);
    } catch (err) {
      log.error(`Failed to create task for ${testCase.id}: ${err}`);
      continue;
    }

    const subject = testCase.subject ?? testCase.description.split(':').pop()?.trim() ?? testCase.id;
    const threshold = options.checkpointThreshold ?? testCase.checkpointThreshold ?? 0.7;

    // Incremental checkpoint path
    if (testCase.checkpoints) {
      log.log('Using incremental checkpoint loop');
      const { checkpoints, allPageResults, harnessLogs, resolvedModel } = await runCheckpointLoop(
        testCase, dir, harness, env, options, log,
      );

      // Compute final composite: 20% source pages, 80% content pages (same split as 2-phase)
      const sourcePages = allPageResults.filter((p) => p.role === 'source');
      const contentPages = allPageResults.filter((p) => p.role !== 'source');

      let composite: number;
      const sourceFraction = testCase.weights?.source ?? 0.2;
      if (sourcePages.length > 0 && contentPages.length > 0) {
        const sourceAvg = sourcePages.reduce((sum, p) => sum + p.composite, 0) / sourcePages.length;
        const contentComposite = contentPages.length === 1
          ? contentPages[0].composite
          : computeWeightedComposite(contentPages, (testCase.expectedEpisodes?.length ?? 0) > 0, testCase.weights);
        composite = Math.round((sourceAvg * sourceFraction + contentComposite * (1 - sourceFraction)) * 1000) / 1000;
      } else if (allPageResults.length > 0) {
        composite = Math.round((allPageResults.reduce((sum, p) => sum + p.composite, 0) / allPageResults.length) * 1000) / 1000;
      } else {
        composite = 0;
      }

      const primaryPage = allPageResults.find((p) => p.role === 'person')
        ?? allPageResults.find((p) => p.role === 'project')
        ?? allPageResults.find((p) => p.role === 'episode')
        ?? allPageResults[0];

      const caseDuration = Date.now() - caseStart;
      const result: EvalResult = {
        caseId: testCase.id,
        suite: options.suite,
        harness: harness.name,
        model: resolvedModel ?? options.model ?? 'default',
        output: primaryPage?.wikitext ?? '',
        scores: primaryPage?.scores ?? [],
        composite,
        timestamp: new Date().toISOString(),
        pages: allPageResults,
        checkpoints,
        durationMs: caseDuration,
        log: harnessLogs.join('\n') || undefined,
      };

      results.push(result);

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const resultPath = join(resultsDir, `${testCase.id}-${harness.name}-${ts}.json`);
      writeFileSync(resultPath, JSON.stringify(result, null, 2));
      log.log(`Result written to ${resultPath}`);

      log.log(`Model: ${resolvedModel ?? options.model ?? 'default'}`);
      log.log(`Composite: ${composite} (${formatDuration(caseDuration)})`);
      for (const pr of allPageResults) {
        log.log(`  ${pr.role}: ${pr.title} → ${pr.composite.toFixed(3)}`);
      }
      continue;
    }

    let sourceData = '';

    // Step 3: Two-phase harness invocation with checkpoint gating
    const checkpoints: CheckpointResult[] = [];
    const allPageResults: PageResult[] = [];
    let output = '';
    let checkpoint1Failed = false;
    const harnessLogs: string[] = [];
    let resolvedModel: string | undefined;

    if (options.fromResult) {
      // Restore source pages from a previous result, skip Phase 1 harness
      log.log(`Restoring checkpoint 1 from ${options.fromResult}`);
      const prevCp1 = restoreSourcePages(options.fromResult, env, log);
      checkpoints.push(prevCp1);
      allPageResults.push(...prevCp1.pages);
      checkpoint1Failed = !prevCp1.passed;
      log.log(`Checkpoint 1 (restored): ${prevCp1.composite.toFixed(3)} → ${prevCp1.passed ? 'PASS' : 'FAIL'}`);

      // Populate the vault by snapshotting source directories.
      // This is cheap I/O (no LLM) — just hashing files into the vault
      // so the accuracy grader can resolve citations against real data.
      for (const source of testCase.sources) {
        const sourcePath = isAbsolute(source.path) ? source.path : join(dir, source.path);
        log.log(`Snapshotting ${sourcePath} into vault`);
        try {
          execWai(`snapshot "${sourcePath}"`, env);
        } catch (err) {
          log.error(`Snapshot failed for ${sourcePath}: ${err}`);
        }
      }
    } else {
      // PHASE 1: Invoke harness for source enrichment
      log.log(`Phase 1: Invoking harness (source) — ${harness.name}`);
      try {
        const result = await harness.run(testCase, env, { phase: 'source' });
        if (result.log) harnessLogs.push(result.log);
        if (result.model) resolvedModel = result.model;
        log.log('Phase 1 harness finished');
      } catch (err) {
        log.error(`Phase 1 harness failed for ${testCase.id}: ${err}`);
        continue;
      }

      // CHECKPOINT 1 — Grade source pages
      log.log(`Discovering source pages (subject: "${subject}")`);
      const sourcePages = discoverSourcePages(env);
      log.log(`Discovered ${sourcePages.length} source page(s): ${sourcePages.map((p) => p.title).join(', ') || '(none)'}`);

      if (sourcePages.length > 0) {
        const sourceResults = await gradePages(sourcePages, testCase, dir, sourceData, subject, env, log, harnessLogs.join('\n'));
        allPageResults.push(...sourceResults);

        const sourceComposite = sourceResults.length > 0
          ? Math.round((sourceResults.reduce((sum, p) => sum + p.composite, 0) / sourceResults.length) * 1000) / 1000
          : 0;
        const passed = sourceComposite >= threshold;

        checkpoints.push({
          checkpoint: 1,
          stage: 'source',
          pages: sourceResults,
          composite: sourceComposite,
          passed,
          threshold,
        });

        log.log(`Checkpoint 1 (source): ${sourceComposite.toFixed(3)} ${passed ? '>=' : '<'} ${threshold} → ${passed ? 'PASS' : 'FAIL'}`);
        checkpoint1Failed = !passed;
      }
    }

    // PHASE 2: Invoke harness for content pages (skip if checkpoint 1 failed)
    let contentResults: PageResult[] = [];
    if (!checkpoint1Failed) {
      log.log(`Phase 2: Invoking harness (content) — ${harness.name}`);
      try {
        const result = await harness.run(testCase, env, { phase: 'content' });
        if (result.log) harnessLogs.push(result.log);
        if (result.model) resolvedModel = result.model;
        log.log('Phase 2 harness finished');
      } catch (err) {
        log.error(`Phase 2 harness failed for ${testCase.id}: ${err}`);
        // Continue to grade whatever content pages may exist
      }

      // CHECKPOINT 2 — Grade content pages
      log.log(`Discovering content pages (subject: "${subject}")`);
      const contentPages = discoverContentPages(env, subject);
      log.log(`Discovered ${contentPages.length} content page(s): ${contentPages.map((p) => `${p.role}:${p.title}`).join(', ') || '(none)'}`);

      if (contentPages.length > 0) {
        contentResults = await gradePages(contentPages, testCase, dir, sourceData, subject, env, log, harnessLogs.join('\n'));
        allPageResults.push(...contentResults);

        const contentComposite = contentResults.length === 1
          ? contentResults[0].composite
          : computeWeightedComposite(contentResults, (testCase.expectedEpisodes?.length ?? 0) > 0, testCase.weights);

        checkpoints.push({
          checkpoint: 2,
          stage: 'content',
          pages: contentResults,
          composite: contentComposite,
          passed: true,
          threshold,
        });

        log.log(`Checkpoint 2 (content): ${contentComposite.toFixed(3)}`);
      }
    } else {
      log.log('Skipping phase 2 — source quality below threshold');
    }

    // Fallback: if no pages discovered at all, read the primary page directly
    if (allPageResults.length === 0) {
      const pageTitle = subject;
      log.log(`No pages discovered, falling back to reading "${pageTitle}"`);
      try {
        output = readWikiPage(pageTitle, env);
      } catch {
        log.error(`Could not read fallback page "${pageTitle}", using harness output`);
      }

      const referenceWikitext = loadReferenceWikitext(testCase, dir, pageTitle, 'person');
      const fallbackVaultPath = env['WAI_VAULT_PATH'];
      const scores = await runGraders(output, testCase, sourceData, {
        referenceWikitext,
        vault: fallbackVaultPath ? { vaultPath: fallbackVaultPath } : undefined,
        log: harnessLogs.join('\n'),
      });
      const composite = computeComposite(scores);

      allPageResults.push({
        title: pageTitle,
        role: 'person',
        wikitext: output,
        scores,
        composite,
      });
    }

    // Step 5: Compute final composite
    let composite: number;
    const hasCheckpoints = checkpoints.length > 0;

    const sourceFraction2 = testCase.weights?.source ?? 0.2;
    if (hasCheckpoints) {
      const cp1 = checkpoints.find((c) => c.checkpoint === 1);
      const cp2 = checkpoints.find((c) => c.checkpoint === 2);

      if (cp1 && cp2) {
        composite = Math.round((cp1.composite * sourceFraction2 + cp2.composite * (1 - sourceFraction2)) * 1000) / 1000;
      } else if (cp1 && !cp1.passed) {
        composite = Math.round((cp1.composite * sourceFraction2) * 1000) / 1000;
      } else if (cp1) {
        composite = Math.round((cp1.composite * sourceFraction2) * 1000) / 1000;
      } else {
        composite = allPageResults.length === 1
          ? allPageResults[0].composite
          : computeWeightedComposite(allPageResults, (testCase.expectedEpisodes?.length ?? 0) > 0, testCase.weights);
      }
    } else {
      const hasExpectedEpisodes = (testCase.expectedEpisodes?.length ?? 0) > 0;
      composite = allPageResults.length === 1
        ? allPageResults[0].composite
        : computeWeightedComposite(allPageResults, hasExpectedEpisodes, testCase.weights);
    }

    // Primary page for backward compat
    const primaryPage = allPageResults.find((p) => p.role === 'person')
      ?? allPageResults.find((p) => p.role === 'project')
      ?? allPageResults[0];

    const caseDuration = Date.now() - caseStart;
    const result: EvalResult = {
      caseId: testCase.id,
      suite: options.suite,
      harness: harness.name,
      model: resolvedModel ?? options.model ?? 'default',
      output: primaryPage.wikitext,
      scores: primaryPage.scores,
      composite,
      timestamp: new Date().toISOString(),
      pages: allPageResults,
      checkpoints: hasCheckpoints ? checkpoints : undefined,
      durationMs: caseDuration,
      log: harnessLogs.join('\n') || undefined,
    };

    results.push(result);

    // Write individual result
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const resultPath = join(resultsDir, `${testCase.id}-${harness.name}-${ts}.json`);
    writeFileSync(resultPath, JSON.stringify(result, null, 2));
    log.log(`Result written to ${resultPath}`);

    log.log(`Model: ${resolvedModel ?? options.model ?? 'default'}`);
    log.log(`Composite: ${composite} (${formatDuration(caseDuration)})`);
    for (const pr of allPageResults) {
      log.log(`  ${pr.role}: ${pr.title} → ${pr.composite.toFixed(3)}`);
    }
  }

  return results;
}

export async function runE2E(options: E2EOptions): Promise<EvalResult[]> {
  const fixturesDir = options.fixturesDir ?? join(resolve('.'), 'fixtures');
  const resultsDir = options.resultsDir ?? join(resolve('.'), 'results');
  mkdirSync(resultsDir, { recursive: true });

  const log = createLogger(resultsDir);
  log.log(`Log file: ${log.path}`);
  log.log(`Suite: ${options.suite}, Harness: ${options.harness}, Model: ${options.model ?? 'default'}`);

  const harness = getHarness(options.harness, options.model);
  let cases = loadTestCases(fixturesDir, options.suite);
  if (options.caseFilter) {
    cases = cases.filter((c) => c.testCase.id === options.caseFilter);
    if (cases.length === 0) {
      throw new Error(`No test case found with id "${options.caseFilter}"`);
    }
  }
  log.log(`Loaded ${cases.length} test case(s)`);

  // External wiki: use the user's existing wai config and process env
  if (options.externalWiki) {
    log.log('Using external wiki (existing wai credentials)');
    const env: Record<string, string | undefined> = { ...process.env };
    return runCases(cases, harness, env, options, resultsDir, log);
  }

  // Isolated wiki: spin up a fresh instance
  const port = parseInt(process.env['WIKI_PORT'] ?? '8081', 10);
  log.log(`Starting isolated wiki on port ${port}`);
  const wiki = await startWiki(port);
  log.log(`Wiki ready at ${wiki.url} (data: ${wiki.dataPath})`);

  try {
    configureWaiCredentials(wiki);
    const env: Record<string, string | undefined> = { ...process.env, ...wiki.env };
    return await runCases(cases, harness, env, options, resultsDir, log);
  } finally {
    if (options.inspect) {
      log.log(`Inspect mode: wiki running at ${wiki.url}`);
      await waitForEnter(`\n==> Wiki is running at ${wiki.url}\n    Press Enter to tear down and exit...`);
    }
    log.log('Tearing down wiki');
    wiki.destroy();
  }
}
