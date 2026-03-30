// @ts-check
/**
 * E2E test that launches the packaged whoami desktop app, completes the
 * setup wizard, and verifies the wiki is running and accessible.
 *
 * Expects the app to be installed at /Applications/whoami.app (macOS).
 * Playwright drives the Electron process directly.
 *
 * By default the app process is left running so subsequent workflow steps
 * can test the CLI against the live wiki. Pass --close to shut it down.
 */

const { _electron: electron } = require('playwright');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const http = require('http');
const assert = require('assert');
const os = require('os');

const APP_PATH = process.env.APP_PATH || '/Applications/whoami.app/Contents/MacOS/whoami';
const WIKI_URL = 'http://127.0.0.1:8080';
const CREDENTIALS_PATH = join(os.homedir(), '.whoami', 'credentials.json');
const PID_FILE = '/tmp/whoami-e2e.pid';
const shouldClose = process.argv.includes('--close');

const SETUP_PARAMS = {
  name: 'Test User',
  username: 'TestUser',
  password: 'TestPassword123',
};

/** Poll until a URL responds with 200 or timeout. */
function waitForUrl(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      http.get(url, (res) => {
        if (res.statusCode === 200) resolve(undefined);
        else setTimeout(check, 500);
        res.resume();
      }).on('error', () => setTimeout(check, 500));
    };
    check();
  });
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Bad JSON from ${url}: ${data.slice(0, 200)}`)); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Launching whoami desktop app...');
  const app = await electron.launch({
    executablePath: APP_PATH,
    timeout: 60_000,
  });

  // Save the PID so the workflow can kill the app later
  const pid = app.process().pid;
  writeFileSync(PID_FILE, String(pid));
  console.log(`App PID: ${pid}`);

  let success = false;
  try {
    // ── Setup wizard should appear on first run ──────────────────────
    console.log('Waiting for setup wizard...');
    const setupWindow = await app.firstWindow();
    await setupWindow.waitForLoadState('domcontentloaded');

    const title = await setupWindow.title();
    assert.ok(
      title.includes('Welcome') || title.includes('whoami'),
      `Unexpected window title: ${title}`,
    );

    await setupWindow.waitForSelector('#setup-form', { state: 'visible', timeout: 10_000 });
    console.log('Setup wizard loaded');

    // ── Fill in the setup form ───────────────────────────────────────
    console.log('Filling setup form...');
    await setupWindow.fill('#name', SETUP_PARAMS.name);
    await setupWindow.fill('#username', SETUP_PARAMS.username);
    await setupWindow.fill('#password', SETUP_PARAMS.password);
    await setupWindow.click('#submit-btn');
    console.log('Form submitted');

    // ── Wait for setup to complete ───────────────────────────────────
    console.log('Waiting for setup to complete (this may take a minute)...');
    await setupWindow.waitForSelector('[data-step="userpage"].done', {
      state: 'attached',
      timeout: 120_000,
    });
    console.log('Setup completed');

    // ── Wiki window should open ──────────────────────────────────────
    console.log('Waiting for wiki window...');
    let wikiWindow;
    const windows = app.windows();
    if (windows.length > 1) {
      wikiWindow = windows.find((w) => w !== setupWindow) || windows[windows.length - 1];
    } else {
      wikiWindow = await app.waitForEvent('window', { timeout: 30_000 });
    }
    await wikiWindow.waitForLoadState('domcontentloaded');
    console.log('Wiki window opened');

    // ── Verify the wiki is serving ───────────────────────────────────
    console.log('Waiting for wiki server...');
    await waitForUrl(`${WIKI_URL}/api.php?action=query&meta=siteinfo&format=json`);
    console.log('Wiki server is responding');

    // ── Verify Main Page content ─────────────────────────────────────
    console.log('Checking Main Page...');
    const mainPage = await httpGetJson(`${WIKI_URL}/api.php?action=parse&page=Main+Page&format=json`);
    const mainHtml = mainPage.parse.text['*'];
    assert.ok(
      mainHtml.toLowerCase().includes('welcome to your wiki'),
      'Main Page missing custom content',
    );
    console.log('OK Main Page has custom content');

    // ── Verify credentials file ──────────────────────────────────────
    console.log('Checking credentials...');
    assert.ok(existsSync(CREDENTIALS_PATH), 'credentials.json not created');
    const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    assert.strictEqual(creds.username, SETUP_PARAMS.username);
    assert.strictEqual(creds.role, 'owner');
    console.log('OK credentials.json exists with correct username');

    // ── Verify Me redirect ───────────────────────────────────────────
    console.log('Checking Me redirect...');
    const meResp = await httpGetJson(`${WIKI_URL}/api.php?action=query&titles=Me&redirects=1&format=json`);
    const redirects = meResp.query.redirects || [];
    assert.ok(redirects.length > 0, 'Me page did not redirect');
    assert.strictEqual(redirects[0].to, SETUP_PARAMS.name);
    console.log(`OK Me -> ${SETUP_PARAMS.name}`);

    // ── Verify user page ─────────────────────────────────────────────
    console.log('Checking user page...');
    const userResp = await httpGetJson(
      `${WIKI_URL}/api.php?action=query&titles=${encodeURIComponent(SETUP_PARAMS.name)}&prop=revisions&rvprop=content&rvslots=main&format=json`,
    );
    const page = Object.values(userResp.query.pages)[0];
    const content = page.revisions[0].slots.main['*'];
    assert.ok(content.includes('{{Infobox person'), 'Missing infobox');
    assert.ok(content.includes(SETUP_PARAMS.name), 'Missing user name');
    assert.ok(content.includes('[[Category:People]]'), 'Missing category');
    console.log('OK user page has infobox, name, and category');

    console.log('\nAll app-level checks passed!');
    success = true;
  } finally {
    if (shouldClose || !success) {
      await app.close();
    } else {
      // Detach from Playwright but leave the Electron process running
      // so subsequent workflow steps can test the CLI against the wiki.
      console.log(`\nApp left running (PID ${pid}). Kill with: kill ${pid}`);
    }
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
