import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ApiClient, NotFound, BadRequest } from '../src/api-client.js';

function withServer<T>(handler: (req: any, res: any) => void, fn: (base: string) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      try { resolve(await fn(`http://127.0.0.1:${port}`)); }
      catch (err) { reject(err); }
      finally { server.close(); }
    });
  });
}

test('ApiClient.read: parses 200 JSON', async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.url, '/api/pages/foo');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ slug: 'foo', meta: { title: 'Foo' }, body: 'hi' }));
    },
    async (base) => {
      const c = new ApiClient(base);
      const page = await c.read('foo');
      assert.equal(page.slug, 'foo');
    },
  );
});

test('ApiClient.read: 404 throws NotFound', async () => {
  await withServer(
    (_req, res) => { res.statusCode = 404; res.setHeader('content-type', 'application/json'); res.end('{"error":"not-found"}'); },
    async (base) => {
      const c = new ApiClient(base);
      await assert.rejects(() => c.read('nope'), (err: Error) => err instanceof NotFound);
    },
  );
});

test('ApiClient.write: PUTs JSON body', async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.method, 'PUT');
      let body = '';
      req.on('data', (c: Buffer) => { body += c.toString(); });
      req.on('end', () => {
        assert.deepEqual(JSON.parse(body), { body: 'new', summary: 'add' });
        res.setHeader('content-type', 'application/json');
        res.end('{"ok":true}');
      });
    },
    async (base) => {
      const c = new ApiClient(base);
      await c.write('foo', 'new', 'add');
    },
  );
});

test('ApiClient.write: 400 throws BadRequest', async () => {
  await withServer(
    (_req, res) => { res.statusCode = 400; res.setHeader('content-type', 'application/json'); res.end('{"error":"bad-request"}'); },
    async (base) => {
      const c = new ApiClient(base);
      await assert.rejects(() => c.write('foo', '', 'x'), (err: Error) => err instanceof BadRequest);
    },
  );
});
