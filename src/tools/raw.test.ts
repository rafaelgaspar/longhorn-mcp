import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/server';
import { LonghornClient } from '../longhorn/client.js';
import type { ToolResult } from './tool-def.js';
import { tools } from './raw.js';

type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;
interface CapturedTool {
  handler: Handler;
  inputSchema: { parse(args: unknown): { path: string } };
}

// In production, @modelcontextprotocol/server's registerTool() validates
// incoming args against inputSchema before ever invoking the handler — this
// fake server captures both pieces so tests can exercise that same order,
// rather than calling the handler directly and silently skipping zod
// validation (a real gap this file's tests previously had).
function captureTool(name: string, client: LonghornClient): CapturedTool {
  const tool = tools.find((tool) => tool.name === name);
  assert.ok(tool, `no tool named ${name}`);

  let captured: CapturedTool | undefined;
  const server = {
    registerTool(_name: string, meta: { inputSchema: CapturedTool['inputSchema'] }, cb: Handler) {
      captured = { handler: cb, inputSchema: meta.inputSchema };
    },
  } as unknown as McpServer;

  tool.register(server, client);
  assert.ok(captured, `${name} did not register a callback`);
  return captured;
}

function captureHandler(name: string, client: LonghornClient): Handler {
  return captureTool(name, client).handler;
}

test('longhorn_raw_request is registered even in read-only mode (write: false at the registration layer)', () => {
  const tool = tools.find((tool) => tool.name === 'longhorn_raw_request');
  assert.equal(tool?.write, false);
});

test('longhorn_raw_request delegates to the shared LonghornClient and inherits its read-only guard for non-GET methods', async (t: TestContext) => {
  const fetchMock = t.mock.fn(async () => new Response('{}', { status: 200 }));
  t.mock.method(globalThis, 'fetch', fetchMock);

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: true });
  const handler = captureHandler('longhorn_raw_request', client);

  const result = await handler({ method: 'DELETE', path: '/v1/volumes/my-volume' });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /read-only/i);
  assert.equal(fetchMock.mock.calls.length, 0, 'the escape hatch must not reach Longhorn for a blocked write');
});

test('longhorn_raw_request still allows GET through the read-only guard', async (t: TestContext) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));

  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: true });
  const handler = captureHandler('longhorn_raw_request', client);

  const result = await handler({ method: 'GET', path: '/v1/volumes' });

  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0].text), { data: [] });
});

test('longhorn_raw_request rejects a path that does not start with /v1/ at the schema layer', () => {
  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: false });
  const { inputSchema } = captureTool('longhorn_raw_request', client);

  assert.throws(() => inputSchema.parse({ method: 'GET', path: '/metrics' }), /\/v1\//);
  assert.equal(inputSchema.parse({ method: 'GET', path: '/v1/volumes' }).path, '/v1/volumes');
});

test('longhorn_raw_request rejects dot-segment path traversal that resolves outside /v1/ once normalized', () => {
  const client = new LonghornClient({ baseUrl: 'http://longhorn-backend:9500', readOnly: false });
  const { inputSchema } = captureTool('longhorn_raw_request', client);

  // A bare startsWith('/v1/') check passes this string, but fetch()/undici
  // resolve dot-segments per the URL spec, so the real request would have
  // landed on /metrics — this is the exact bypass that must stay closed.
  assert.throws(() => inputSchema.parse({ method: 'GET', path: '/v1/../metrics' }), /\/v1\//);
  assert.throws(() => inputSchema.parse({ method: 'GET', path: '/v1/volumes/../../etc/passwd' }), /\/v1\//);

  // Traversal that still resolves inside /v1/ is fine — normalize, don't reject outright.
  assert.equal(inputSchema.parse({ method: 'GET', path: '/v1/volumes/../snapshots' }).path, '/v1/snapshots');
});
