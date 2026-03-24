import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { resolveCredentials, saveCredentials, removeCredentials, credentialsPath } from '../auth.js';
import { WikiClient } from '../wiki-client.js';
import { UsageError } from '../errors.js';
import { type GlobalFlags, outputJson } from '../output.js';

export async function authCommand(args: string[], globals: GlobalFlags): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'login':
      return login(subArgs, globals);
    case 'logout':
      return logout(globals);
    case 'status':
      return status(globals);
    default:
      throw new UsageError('Usage: wai auth <login|logout|status>');
  }
}

async function login(args: string[], globals: GlobalFlags): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      server: { type: 'string' },
      username: { type: 'string' },
      password: { type: 'string' },
    },
    allowPositionals: false,
    strict: false,
  });

  let server = values.server as string | undefined;
  let username = values.username as string | undefined;
  let password = values.password as string | undefined;

  // Interactive mode if any value is missing
  if (!server || !username || !password) {
    if (!server) {
      server = 'http://localhost:8080';
    }
    if (!username) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        username = await rl.question('Username: ');
      } finally {
        rl.close();
      }
    }
    if (!password) {
      password = await readPassword('Password: ');
    }
  }

  process.stderr.write('Logging in... ');
  const client = new WikiClient(server);
  await client.login(username, password);
  saveCredentials({ server, username, password });
  console.error('OK');
  console.error(`Credentials saved to ${credentialsPath()}`);
}

async function logout(globals: GlobalFlags): Promise<void> {
  removeCredentials();
  console.log('Credentials removed.');
}

async function status(globals: GlobalFlags): Promise<void> {
  try {
    const creds = resolveCredentials();
    const client = new WikiClient(creds.server);

    let authenticated = false;
    try {
      await client.login(creds.username, creds.password);
      authenticated = true;
    } catch {
      // login failed
    }

    const info = {
      server: creds.server,
      username: creds.username,
      source: credentialsPath(),
      status: authenticated ? 'authenticated' : 'login failed',
    };

    if (globals.json) {
      outputJson(info);
    } else {
      console.log(`Server:    ${info.server}`);
      console.log(`Username:  ${info.username}`);
      console.log(`Source:    ${info.source}`);
      console.log(`Status:    ${info.status}`);
    }
  } catch (e: any) {
    if (globals.json) {
      outputJson({ status: 'not configured', error: e.message });
    } else {
      console.log(`Status:    not configured`);
      console.log(`           ${e.message}`);
    }
  }
}

async function readPassword(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let pw = '';
    const onData = (ch: string) => {
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(pw);
      } else if (ch === '\u0003') {
        stdin.setRawMode(false);
        stdin.pause();
        process.exit(1);
      } else if (ch === '\u007f' || ch === '\b') {
        pw = pw.slice(0, -1);
      } else {
        pw += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}
