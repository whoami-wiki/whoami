import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import http from 'node:http';

const HEALTH_POLL_MS = 200;
const HEALTH_TIMEOUT_MS = 30_000;

const DESKTOP_ROOT = resolve(import.meta.dirname ?? '.', '..', '..', 'desktop');
const RESOURCES = join(DESKTOP_ROOT, 'resources');
const PHP_PATH = join(RESOURCES, 'php', 'bin', 'php');
const LUA_PATH = join(RESOURCES, 'lua', 'bin', 'lua');
const MW_PATH = join(RESOURCES, 'mediawiki');
const TEMPLATES_PATH = join(RESOURCES, 'templates');

export interface WikiInstance {
  url: string;
  port: number;
  dataPath: string;
  vaultPath: string;
  username: string;
  password: string;
  /** Environment variables to pass to wai and harness processes */
  env: Record<string, string>;
  stop: () => void;
  destroy: () => void;
}

function generateSecretKey(): string {
  return randomBytes(32).toString('hex');
}

function generateLocalSettings(opts: {
  dataPath: string;
  serverUrl: string;
  resourcesPath: string;
}): string {
  return [
    '<?php',
    '',
    `$wgSecretKey = "${generateSecretKey()}";`,
    `$wgUpgradeKey = "${generateSecretKey().slice(0, 16)}";`,
    '',
    '## Core',
    '$wgSitename = "Whoami Wiki";',
    `$wgServer = "${opts.serverUrl}";`,
    '$wgScriptPath = "";',
    '$wgArticlePath = "/wiki/$1";',
    '',
    '## Database (SQLite)',
    '$wgDBtype = "sqlite";',
    '$wgDBname = "wiki";',
    `$wgSQLiteDataDir = "${opts.dataPath}";`,
    '',
    '## Paths',
    `$wgUploadDirectory = "${opts.dataPath}/images";`,
    '$wgUploadPath = "/images";',
    `$wgCacheDirectory = "${opts.dataPath}/cache";`,
    '',
    '## Security',
    "$wgGroupPermissions['*']['createaccount'] = false;",
    "$wgGroupPermissions['*']['edit'] = false;",
    "$wgGroupPermissions['*']['read'] = true;",
    '',
    '## Error handling',
    'error_reporting( E_ALL & ~E_DEPRECATED & ~E_STRICT );',
    "ini_set( 'display_errors', '0' );",
    '',
    '## Locale',
    '$wgLanguageCode = "en";',
    '$wgLocaltimezone = "UTC";',
    '',
    '## Uploads',
    '$wgEnableUploads = true;',
    '$wgUseImageMagick = false;',
    "$wgFileExtensions = array_merge( $wgFileExtensions, [ 'mp3', 'mp4', 'ogg', 'ogv', 'opus', 'wav', 'webm', 'flac' ] );",
    "ini_set( 'upload_max_filesize', '50M' );",
    "ini_set( 'post_max_size', '55M' );",
    '$wgMaxUploadSize = 1024 * 1024 * 50;',
    '$wgVerifyMimeType = false;',
    '',
    '## Skin',
    "wfLoadSkin( 'Vector' );",
    '$wgDefaultSkin = "vector-2022";',
    '',
    '## Extensions',
    "wfLoadExtension( 'Cite' );",
    "wfLoadExtension( 'CiteThisPage' );",
    "wfLoadExtension( 'ParserFunctions' );",
    "wfLoadExtension( 'Scribunto' );",
    "wfLoadExtension( 'TemplateData' );",
    "wfLoadExtension( 'TemplateStyles' );",
    ...(existsSync(join(opts.resourcesPath, 'mediawiki', 'extensions', 'TimedMediaHandler', 'extension.json')) ? [
      "wfLoadExtension( 'TimedMediaHandler' );",
      '',
      '## TimedMediaHandler',
      '$wgTmhEnableTranscoding = false;',
      "$wgTmhFileExtensions = [ 'mp3', 'mp4', 'ogg', 'ogv', 'opus', 'wav', 'webm', 'flac' ];",
      `$wgFFmpegLocation = '${opts.resourcesPath}/ffmpeg/bin/ffmpeg';`,
      '$wgMaxShellMemory = 0;',
    ] : []),
    '',
    '## Scribunto',
    "$wgScribuntoDefaultEngine = 'luastandalone';",
    `$wgScribuntoEngineConf['luastandalone']['luaPath'] = '${LUA_PATH}';`,
    '',
    '## Drawing namespace (100/101)',
    'define("NS_DRAWING", 100);',
    'define("NS_DRAWING_TALK", 101);',
    '$wgExtraNamespaces[NS_DRAWING] = "Drawing";',
    '$wgExtraNamespaces[NS_DRAWING_TALK] = "Drawing_talk";',
    '',
    '## Spec namespace (102/103)',
    'define("NS_SPEC", 102);',
    'define("NS_SPEC_TALK", 103);',
    '$wgExtraNamespaces[NS_SPEC] = "Spec";',
    '$wgExtraNamespaces[NS_SPEC_TALK] = "Spec_talk";',
    '',
    '## Construction namespace (104/105)',
    'define("NS_CONSTRUCTION", 104);',
    'define("NS_CONSTRUCTION_TALK", 105);',
    '$wgExtraNamespaces[NS_CONSTRUCTION] = "Construction";',
    '$wgExtraNamespaces[NS_CONSTRUCTION_TALK] = "Construction_talk";',
    '',
    '## Issue namespace (106/107)',
    'define("NS_ISSUE", 106);',
    'define("NS_ISSUE_TALK", 107);',
    '$wgExtraNamespaces[NS_ISSUE] = "Issue";',
    '$wgExtraNamespaces[NS_ISSUE_TALK] = "Issue_talk";',
    '',
    '## Task namespace (108/109)',
    'define("NS_TASK", 108);',
    'define("NS_TASK_TALK", 109);',
    '$wgExtraNamespaces[NS_TASK] = "Task";',
    '$wgExtraNamespaces[NS_TASK_TALK] = "Task_talk";',
    '',
    '## Short URLs',
    '$wgUsePathInfo = true;',
    '',
    '## Performance',
    '$wgMainCacheType = CACHE_NONE;',
    '$wgCachePages = false;',
    '',
    '## Job queue (run inline)',
    '$wgJobRunRate = 1;',
    '',
  ].join('\n');
}

function runPhp(args: string[], cwd?: string): string {
  return execFileSync(PHP_PATH, [
    '-d', 'display_errors=Off',
    '-d', 'error_reporting=0',
    ...args,
  ], {
    cwd: cwd ?? MW_PATH,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'],
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function waitForServer(url: string): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > HEALTH_TIMEOUT_MS) {
        reject(new Error('Wiki server failed to start within timeout'));
        return;
      }

      const req = http.get(`${url}/api.php?action=query&meta=siteinfo&format=json`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          setTimeout(check, HEALTH_POLL_MS);
        }
      });
      req.on('error', () => {
        setTimeout(check, HEALTH_POLL_MS);
      });
      req.end();
    };
    check();
  });
}

function importPage(confPath: string, title: string, filePath: string): void {
  const content = readFileSync(filePath, 'utf-8');
  writePageDirect(confPath, title, content);
}

/**
 * Write a wiki page directly via PHP maintenance script, bypassing HTTP.
 * Much faster and more reliable than `wai write` for bulk operations.
 */
export function writePageDirect(confPath: string, title: string, content: string): void {
  execFileSync(PHP_PATH, [
    '-d', 'display_errors=Off',
    '-d', 'error_reporting=0',
    'maintenance/run.php', 'edit',
    '--conf', confPath,
    title,
  ], {
    cwd: MW_PATH,
    input: content,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'],
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

/**
 * Spin up an isolated MediaWiki instance using the desktop app's bundled resources.
 * Creates a temp data directory, installs the DB, imports templates, and starts
 * PHP's built-in server on the given port.
 */
export async function startWiki(port: number): Promise<WikiInstance> {
  // Verify desktop resources exist
  if (!existsSync(PHP_PATH)) {
    throw new Error(
      `PHP not found at ${PHP_PATH}. Run desktop/scripts/build-php.sh first.`,
    );
  }
  if (!existsSync(join(MW_PATH, 'index.php'))) {
    throw new Error(
      `MediaWiki not found at ${MW_PATH}. Run desktop/scripts/bundle-mediawiki.sh first.`,
    );
  }

  const username = 'Admin';
  const password = 'evalpass1234';
  const serverUrl = `http://127.0.0.1:${port}`;

  // Create temp data + vault directories
  const basePath = join(tmpdir(), `whoami-eval-${randomBytes(6).toString('hex')}`);
  const dataPath = join(basePath, 'data');
  const vaultPath = join(basePath, 'vault');
  mkdirSync(dataPath, { recursive: true });
  mkdirSync(join(dataPath, 'images'), { recursive: true });
  mkdirSync(join(dataPath, 'cache'), { recursive: true });
  mkdirSync(vaultPath, { recursive: true });

  // Provisioning output goes through the caller's logger, not console

  // Install MediaWiki
  runPhp([
    'maintenance/run.php', 'install',
    '--dbtype', 'sqlite',
    '--dbpath', dataPath,
    '--dbname', 'wiki',
    '--scriptpath', '',
    '--pass', password,
    '--server', serverUrl,
    'Whoami Wiki', username,
  ]);

  // Remove installer-generated LocalSettings.php from MW dir
  const mwLocalSettings = join(MW_PATH, 'LocalSettings.php');
  if (existsSync(mwLocalSettings)) {
    rmSync(mwLocalSettings);
  }

  // Write our LocalSettings.php
  const confPath = join(dataPath, 'LocalSettings.php');
  writeFileSync(confPath, generateLocalSettings({
    dataPath,
    serverUrl,
    resourcesPath: RESOURCES,
  }));

  // Run database update for extensions
  runPhp(['maintenance/run.php', 'update', '--quick', '--conf', confPath]);

  // Import templates
  importPage(confPath, 'Template:Gap', join(TEMPLATES_PATH, 'Gap.wiki'));
  importPage(confPath, 'Template:Dialogue', join(TEMPLATES_PATH, 'Dialogue.wiki'));
  importPage(confPath, 'Template:Infobox person', join(TEMPLATES_PATH, 'Infobox_person.wiki'));

  // Construction project infoboxes
  for (const name of [
    'Infobox_area', 'Infobox_equipment', 'Infobox_system',
    'Infobox_drawing', 'Infobox_spec', 'Infobox_construction',
    'Infobox_issue',
  ]) {
    importPage(confPath, `Template:${name.replace(/_/g, ' ')}`, join(TEMPLATES_PATH, `${name}.wiki`));
  }

  // Citation templates
  for (const name of [
    'Cite_drawing', 'Cite_spec', 'Cite_rfi',
    'Cite_submittal', 'Cite_document', 'Cite_field',
  ]) {
    importPage(confPath, `Template:${name.replace(/_/g, ' ')}`, join(TEMPLATES_PATH, `${name}.wiki`));
  }

  // Utility templates
  for (const name of ['Verbatim', 'Verification', 'Superseded']) {
    importPage(confPath, `Template:${name}`, join(TEMPLATES_PATH, `${name}.wiki`));
  }

  importPage(confPath, 'MediaWiki:Common.css', join(TEMPLATES_PATH, 'infobox-styles.css'));

  // Start PHP built-in server
  const proc: ChildProcess = spawn(PHP_PATH, [
    '-d', 'display_errors=Off',
    '-d', 'error_reporting=0',
    '-S', `127.0.0.1:${port}`,
    '-t', MW_PATH,
    join(MW_PATH, 'router.php'),
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MW_DATA_PATH: dataPath },
  });

  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', () => {});

  await waitForServer(serverUrl);

  const env: Record<string, string> = {
    WIKI_SERVER: serverUrl,
    WIKI_USERNAME: username,
    WIKI_PASSWORD: password,
    WAI_VAULT_PATH: vaultPath,
    WIKI_DATA_PATH: dataPath,
  };

  return {
    url: serverUrl,
    port,
    dataPath,
    vaultPath,
    username,
    password,
    env,
    stop() {
      proc.kill('SIGTERM');
    },
    destroy() {
      proc.kill('SIGTERM');
      rmSync(basePath, { recursive: true, force: true });
    },
  };
}

/**
 * Find a free TCP port on 127.0.0.1 by briefly binding to port 0.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on('error', reject);
  });
}
