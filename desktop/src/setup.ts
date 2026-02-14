import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";
import { net } from "electron";
import {
  startServer,
  stopServer,
  getServerUrl,
  getDataPath,
} from "./php-server.js";

// ── Types ───────────────────────────────────────────────────────────────

interface SetupParams {
  name: string;
  username: string;
  password: string;
}

type StepId = "database" | "mediawiki" | "templates" | "userpage" | "cli";

// ── Public ──────────────────────────────────────────────────────────────

export function isFirstRun(): boolean {
  const dataPath = getDataPath();
  return !existsSync(join(dataPath, "LocalSettings.php"));
}

export async function runSetup(
  params: SetupParams,
  window: BrowserWindow,
): Promise<void> {
  const send = (
    step: StepId,
    status: "running" | "done" | "error",
    detail?: string,
  ) => {
    window.webContents.send("setup:progress", { step, status, detail });
  };

  const dataPath = getDataPath();
  mkdirSync(dataPath, { recursive: true });
  mkdirSync(join(dataPath, "images"), { recursive: true });
  mkdirSync(join(dataPath, "cache"), { recursive: true });

  const phpPath = getPhpPath();
  const mwPath = getMediaWikiPath();

  // 1. Create database via MediaWiki install script
  send("database", "running");

  // Remove any leftover LocalSettings.php from the MW directory (from prior runs)
  const mwLocalSettings = join(mwPath, "LocalSettings.php");
  if (existsSync(mwLocalSettings)) unlinkSync(mwLocalSettings);

  await runPhp(phpPath, mwPath, [
    "maintenance/run.php",
    "install",
    "--dbtype",
    "sqlite",
    "--dbpath",
    dataPath,
    "--dbname",
    "wiki",
    "--scriptpath",
    "",
    "--pass",
    params.password,
    "--server",
    getServerUrl(),
    "Whoami Wiki",
    params.username, // MediaWiki username (no spaces)
  ]);

  // install.php writes LocalSettings.php into the MW dir — remove it,
  // we generate our own in the data directory
  if (existsSync(mwLocalSettings)) unlinkSync(mwLocalSettings);

  send("database", "done");

  // 2. Generate LocalSettings.php with all extensions + config
  send("mediawiki", "running");
  const resourcesPath = getResourcesPath();
  const localSettings = generateLocalSettings({
    dataPath,
    serverUrl: getServerUrl(),
    dbPath: dataPath,
    adminUser: params.username,
    resourcesPath,
  });
  writeFileSync(join(dataPath, "LocalSettings.php"), localSettings);

  // Run update.php to initialize extension tables
  const confPath = join(dataPath, "LocalSettings.php");
  await runPhp(phpPath, mwPath, [
    "maintenance/run.php",
    "update",
    "--quick",
    "--conf",
    confPath,
  ]);
  send("mediawiki", "done");

  // 3. Start server to create pages via API
  send("templates", "running");
  await startServer();
  const apiUrl = `${getServerUrl()}/api.php`;

  // Login
  const loginToken = await apiGet(apiUrl, {
    action: "query",
    meta: "tokens",
    type: "login",
    format: "json",
  }).then((d) => d.query.tokens.logintoken);

  await apiPost(apiUrl, {
    action: "login",
    lgname: params.username,
    lgpassword: params.password,
    lgtoken: loginToken,
    format: "json",
  });

  const csrfToken = await apiGet(apiUrl, {
    action: "query",
    meta: "tokens",
    format: "json",
  }).then((d) => d.query.tokens.csrftoken);

  // Create templates
  const templatesDir = getTemplatesPath();

  await createPage(
    apiUrl,
    csrfToken,
    "Template:Gap",
    readFileSync(join(templatesDir, "Gap.wiki"), "utf-8"),
    "Initial template import",
  );

  await createPage(
    apiUrl,
    csrfToken,
    "Template:Dialogue",
    readFileSync(join(templatesDir, "Dialogue.wiki"), "utf-8"),
    "Initial template import",
  );

  // Import Common.css
  await createPage(
    apiUrl,
    csrfToken,
    "MediaWiki:Common.css",
    readFileSync(join(templatesDir, "infobox-styles.css"), "utf-8"),
    "Initial styles import",
  );

  // Import Infobox templates via XML if available
  const infoboxXml = join(templatesDir, "infobox-export.xml");
  if (existsSync(infoboxXml)) {
    await runPhp(phpPath, mwPath, [
      "maintenance/run.php",
      "importDump",
      "--conf",
      confPath,
      infoboxXml,
    ]);
  }

  send("templates", "done");

  // 4. Create user's name page + [[Me]] redirect
  send("userpage", "running");
  const namePage = `{{Infobox person\n| name = ${params.name}\n}}\n\n'''${params.name}'''.\n\n[[Category:People]]`;
  await createPage(
    apiUrl,
    csrfToken,
    params.name,
    namePage,
    "Initial page creation",
  );
  await createPage(
    apiUrl,
    csrfToken,
    "Me",
    `#REDIRECT [[${params.name}]]`,
    "Redirect to user page",
  );
  send("userpage", "done");

  // 5. Create bot password for CLI + configure wai
  send("cli", "running");
  await installCli();
  await configureCli(params.username, params.password);
  send("cli", "done");
}

// ── Local Settings Generation ───────────────────────────────────────────

function generateLocalSettings(opts: {
  dataPath: string;
  serverUrl: string;
  dbPath: string;
  adminUser: string;
  resourcesPath: string;
}): string {
  return `<?php
# Generated by Whoami Wiki desktop app
# This file is auto-generated — edit with care.

## Core
$wgSitename = "Whoami Wiki";
$wgServer = "${opts.serverUrl}";
$wgScriptPath = "";
$wgArticlePath = "/wiki/$1";

## Database (SQLite)
$wgDBtype = "sqlite";
$wgDBname = "wiki";
$wgSQLiteDataDir = "${opts.dbPath}";

## Paths
$wgUploadDirectory = "${opts.dataPath}/images";
$wgUploadPath = "/images";
$wgCacheDirectory = "${opts.dataPath}/cache";

## Security
$wgSecretKey = "${generateSecretKey()}";
$wgUpgradeKey = "${generateSecretKey().slice(0, 16)}";
$wgGroupPermissions['*']['createaccount'] = false;
$wgGroupPermissions['*']['edit'] = false;
$wgGroupPermissions['*']['read'] = true;

## Error handling (suppress PHP 8.5 deprecation notices in HTTP output)
error_reporting( E_ALL & ~E_DEPRECATED & ~E_STRICT );
ini_set( 'display_errors', '0' );

## Locale
$wgLanguageCode = "en";
$wgLocaltimezone = "UTC";

## Uploads
$wgEnableUploads = true;
$wgUseImageMagick = false;  // Use GD instead

## Skin
wfLoadSkin( 'Vector' );
$wgDefaultSkin = "vector-2022";

## Extensions
wfLoadExtension( 'Cite' );
wfLoadExtension( 'CiteThisPage' );
wfLoadExtension( 'ParserFunctions' );
wfLoadExtension( 'Scribunto' );
wfLoadExtension( 'TemplateData' );
wfLoadExtension( 'TemplateStyles' );

## Scribunto
$wgScribuntoDefaultEngine = 'luastandalone';
$wgScribuntoEngineConf['luastandalone']['luaPath'] = '${opts.resourcesPath}/lua/bin/lua';

## Source namespace (100/101)
define("NS_SOURCE", 100);
define("NS_SOURCE_TALK", 101);
$wgExtraNamespaces[NS_SOURCE] = "Source";
$wgExtraNamespaces[NS_SOURCE_TALK] = "Source_talk";

## Task namespace (102/103)
define("NS_TASK", 102);
define("NS_TASK_TALK", 103);
$wgExtraNamespaces[NS_TASK] = "Task";
$wgExtraNamespaces[NS_TASK_TALK] = "Task_talk";

## Short URLs
$wgUsePathInfo = true;

## Performance
$wgMainCacheType = CACHE_NONE;
$wgCachePages = false;

## Job queue (run inline since this is single-user)
$wgJobRunRate = 1;
`;
}

function generateSecretKey(): string {
  const chars = "0123456789abcdef";
  let key = "";
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    key += chars[b & 0xf];
  }
  return key;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getResourcesPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "resources")
    : join(app.getAppPath(), "resources");
}

function getPhpPath(): string {
  return join(getResourcesPath(), "php", "bin", "php");
}

function getMediaWikiPath(): string {
  return join(getResourcesPath(), "mediawiki");
}

function getTemplatesPath(): string {
  return join(getResourcesPath(), "templates");
}

function runPhp(
  phpPath: string,
  cwd: string,
  args: string[],
  extraEnv?: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const phpArgs = [
      "-d",
      "display_errors=Off",
      "-d",
      "error_reporting=22527",
      ...args,
    ];
    execFile(
      phpPath,
      phpArgs,
      {
        cwd,
        env: { ...process.env, ...extraEnv },
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024, // 10MB — MW dumps a lot of deprecation warnings
      },
      (error, stdout, stderr) => {
        // Filter out PHP deprecation noise to find real errors
        const realErrors = stderr
          .split("\n")
          .filter(
            (line) =>
              line &&
              !line.includes("Deprecated:") &&
              !line.includes("deprecated since"),
          )
          .join("\n")
          .trim();

        if (error && realErrors) {
          console.error(`[setup] PHP error: ${realErrors}`);
          reject(new Error(`PHP command failed: ${realErrors}`));
          return;
        }
        // Success (or only deprecation warnings)
        console.log(`[setup] PHP stdout: ${stdout.slice(0, 500)}`);
        resolve(stdout);
      },
    );
  });
}

function apiGet(apiUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(apiUrl);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Promise((resolve, reject) => {
    const request = net.request(url.toString());
    if (sessionCookies.length > 0) {
      request.setHeader("Cookie", sessionCookies.join("; "));
    }
    let body = "";
    request.on("response", (response) => {
      // Capture session cookies from GET responses too
      const setCookies = response.headers["set-cookie"];
      if (setCookies) {
        const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
        for (const c of cookies) {
          const nameValue = c.split(";")[0];
          sessionCookies = sessionCookies.filter(
            (sc) => sc.split("=")[0] !== nameValue.split("=")[0],
          );
          sessionCookies.push(nameValue);
        }
      }
      response.on("data", (chunk) => {
        body += chunk.toString();
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Invalid JSON: ${body.slice(0, 200)}`));
        }
      });
    });
    request.on("error", reject);
    request.end();
  });
}

// Session cookie jar for login persistence
let sessionCookies: string[] = [];

function apiPost(apiUrl: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params).toString();
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "POST",
      url: apiUrl,
    });
    request.setHeader("Content-Type", "application/x-www-form-urlencoded");
    if (sessionCookies.length > 0) {
      request.setHeader("Cookie", sessionCookies.join("; "));
    }
    let responseBody = "";
    request.on("response", (response) => {
      // Capture session cookies
      const setCookies = response.headers["set-cookie"];
      if (setCookies) {
        const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
        for (const c of cookies) {
          const nameValue = c.split(";")[0];
          sessionCookies = sessionCookies.filter(
            (sc) => sc.split("=")[0] !== nameValue.split("=")[0],
          );
          sessionCookies.push(nameValue);
        }
      }
      response.on("data", (chunk) => {
        responseBody += chunk.toString();
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          reject(new Error(`Invalid JSON: ${responseBody.slice(0, 200)}`));
        }
      });
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function createPage(
  apiUrl: string,
  token: string,
  title: string,
  content: string,
  summary: string,
): Promise<void> {
  const result = await apiPost(apiUrl, {
    action: "edit",
    title,
    text: content,
    summary,
    createonly: "true",
    token,
    format: "json",
  });
  if (result?.error && result.error.code !== "articleexists") {
    console.error(`[setup] Failed to create ${title}:`, result.error);
  }
}

async function installCli(): Promise<void> {
  // CLI installer is handled separately — just a placeholder for the setup flow
  const { installWaiCli } = await import("./cli-installer.js");
  await installWaiCli();
}

async function configureCli(username: string, password: string): Promise<void> {
  // Write wai CLI credentials
  const { homedir } = await import("node:os");
  const configDir = join(homedir(), ".whoami");
  mkdirSync(configDir, { recursive: true });

  const credentials = {
    server: getServerUrl(),
    username,
    password,
  };
  writeFileSync(
    join(configDir, "credentials.json"),
    JSON.stringify(credentials, null, 2) + "\n",
    { mode: 0o600 },
  );
}
