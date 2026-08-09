import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { LonghornApiError, LonghornClient, LonghornReadOnlyError } from './client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('request() calls fetch with the right URL and method for a plain GET', async (t: TestContext) => {
  const fetchMock = t.mock.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, { data: [] }));
  t.mock.method(globalThis, 'fetch', fetchMock);

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: false });
  const result = await client.request('GET', '/v1/volumes');

  assert.deepEqual(result, { data: [] });
  assert.equal(fetchMock.mock.calls.length, 1);
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'http://longhorn-backend:9500/v1/volumes');
  assert.equal(init?.method, 'GET');
});

test('request() throws LonghornApiError with the server-provided message on a non-2xx response', async (t: TestContext) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => jsonResponse(422, { code: 'InvalidInput', message: 'size must be positive' }),
  );

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: false });

  await assert.rejects(
    () => client.request('POST', '/v1/volumes', { name: 'x' }),
    (error: unknown) => {
      assert.ok(error instanceof LonghornApiError);
      assert.equal(error.status, 422);
      assert.equal(error.code, 'InvalidInput');
      assert.equal(error.message, 'size must be positive');
      return true;
    },
  );
});

test('request() refuses non-GET methods in read-only mode without ever calling fetch', async (t: TestContext) => {
  const fetchMock = t.mock.fn(async () => jsonResponse(200, {}));
  t.mock.method(globalThis, 'fetch', fetchMock);

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: true });

  await assert.rejects(() => client.request('POST', '/v1/volumes', { name: 'x' }), LonghornReadOnlyError);
  assert.equal(fetchMock.mock.calls.length, 0, 'fetch must not be called for a blocked write in read-only mode');

  // GET still works in read-only mode.
  const result = await client.request('GET', '/v1/volumes');
  assert.deepEqual(result, {});
  assert.equal(fetchMock.mock.calls.length, 1);
});

test('request() wraps a non-JSON response body in a LonghornApiError instead of throwing a raw SyntaxError', async (t: TestContext) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>not json</html>', { status: 200 }));

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: false });

  await assert.rejects(() => client.request('GET', '/v1/volumes'), LonghornApiError);
});

test('updateMerged() fetches the current resource and merges the patch on top before PUTting, so PUT-as-full-replace cannot silently clobber unmentioned fields', async (t: TestContext) => {
  // Verified empirically against a live Longhorn manager: PUT is a full
  // resource replace, not a merge-patch — sending only {name, cron} to an
  // existing recurring job reset concurrency to 0 and dropped groups
  // entirely. updateMerged() is the fix: GET first, spread-merge, then PUT
  // the full object back.
  const current = { id: 'my-job', name: 'my-job', cron: 'old-cron', concurrency: 3, groups: ['g1'], links: { self: 'x' } };
  const fetchMock = t.mock.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'GET' || init?.method === undefined) return jsonResponse(200, current);
    return jsonResponse(200, JSON.parse(init.body as string));
  });
  t.mock.method(globalThis, 'fetch', fetchMock);

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: false });
  const result = await client.updateMerged<typeof current>('recurringjobs', 'my-job', { cron: 'new-cron' });

  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[1]?.method, 'GET');
  assert.equal(fetchMock.mock.calls[1].arguments[1]?.method, 'PUT');

  // The unmentioned fields survive; only the patched field changes.
  assert.equal(result.cron, 'new-cron');
  assert.equal(result.concurrency, 3);
  assert.deepEqual(result.groups, ['g1']);
});

test('updateMerged() refuses in read-only mode without ever calling fetch (the merge itself never starts)', async (t: TestContext) => {
  const fetchMock = t.mock.fn(async () => jsonResponse(200, {}));
  t.mock.method(globalThis, 'fetch', fetchMock);

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: true });

  await assert.rejects(() => client.updateMerged('recurringjobs', 'my-job', { cron: 'x' }), LonghornReadOnlyError);
  assert.equal(fetchMock.mock.calls.length, 0);
});
