import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createAppServer, getFilePath } from '../server.mjs';

let server;
let port;

before(async () => {
  server = createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(() => new Promise((resolve) => server.close(resolve)));

/** Raw request so paths such as /../ are sent exactly as written. */
const call = (path, method = 'GET') => new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', reject);
  req.end();
});

test('serves the app shell with correct type and security headers', async () => {
  const res = await call('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.ok(res.body.includes('<title>'));
});

test('serves scripts and styles with the right content types', async () => {
  assert.match((await call('/src/app.js')).headers['content-type'], /text\/javascript/);
  assert.match((await call('/styles.css')).headers['content-type'], /text\/css/);
});

test('HEAD returns headers without a body', async () => {
  const res = await call('/', 'HEAD');
  assert.equal(res.status, 200);
  assert.equal(res.body, '');
  assert.ok(Number(res.headers['content-length']) > 0);
});

test('rejects unsupported methods', async () => {
  const res = await call('/', 'POST');
  assert.equal(res.status, 405);
  assert.equal(res.headers.allow, 'GET, HEAD');
});

test('returns 404 for a missing script and 403 for paths outside the allowlist', async () => {
  assert.equal((await call('/src/missing.js')).status, 404);
  assert.equal((await call('/unknown.css')).status, 403);
});

test('never serves server code, tests, config or directories', async () => {
  for (const path of ['/server.mjs', '/package.json', '/README.md', '/test/planner.test.js', '/.gitignore', '/src/', '/src']) {
    const { status } = await call(path);
    assert.ok(status === 403 || status === 404, `${path} -> ${status}`);
    assert.notEqual(status, 200, path);
  }
});

test('blocks path traversal, encoded traversal and null bytes', async () => {
  for (const path of ['/../server.mjs', '/%2e%2e/server.mjs', '/src/../../etc/passwd', '/src/%2e%2e/%2e%2e/server.mjs', '/index.html%00.js']) {
    const { status, body } = await call(path);
    assert.ok([400, 403, 404].includes(status), `${path} -> ${status}`);
    assert.ok(!body.includes('createServer'), path);
  }
});

test('returns 400 for malformed percent-encoding', async () => {
  assert.equal((await call('/%E0%A4%A')).status, 400);
});

test('getFilePath allowlist', () => {
  assert.ok(getFilePath('/')?.endsWith('index.html'));
  assert.ok(getFilePath('/styles.css'));
  assert.ok(getFilePath('/src/planner.js'));
  assert.equal(getFilePath('/server.mjs'), null);
  assert.equal(getFilePath('/src/notes.txt'), null);
  assert.equal(getFilePath('/test/helpers/fake-dom.js'), null);
});
