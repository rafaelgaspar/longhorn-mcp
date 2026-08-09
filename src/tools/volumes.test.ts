import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/server';
import type { LonghornClient } from '../longhorn/client.js';
import type { ToolResult } from './tool-def.js';
import { tools } from './volumes.js';

type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

function captureHandler(name: string, client: LonghornClient): Handler {
  const tool = tools.find((t) => t.name === name);
  assert.ok(tool, `no tool named ${name}`);

  let captured: Handler | undefined;
  const server = {
    registerTool(_name: string, _meta: unknown, cb: Handler) {
      captured = cb;
    },
  } as unknown as McpServer;

  tool.register(server, client);
  assert.ok(captured, `${name} did not register a callback`);
  return captured;
}

test('volume_list returns the client response as JSON text', async () => {
  const fixture = { data: [{ id: 'vol-1', name: 'vol-1', size: '10Gi' }] };
  const client = { list: async (resource: string) => (resource === 'volumes' ? fixture : undefined) } as unknown as LonghornClient;

  const handler = captureHandler('volume_list', client);
  const result = await handler({});

  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0].text), fixture);
});

test('volume_attach calls client.action with the volume name, "attach", and the remaining args as the body', async () => {
  const calls: unknown[] = [];
  const client = {
    action: async (...args: unknown[]) => {
      calls.push(args);
      return { id: 'my-volume' };
    },
  } as unknown as LonghornClient;

  const handler = captureHandler('volume_attach', client);
  await handler({ name: 'my-volume', hostId: 'mfth50', disableFrontend: true });

  assert.equal(calls.length, 1);
  const [resource, id, action, body] = calls[0] as [string, string, string, Record<string, unknown>];
  assert.equal(resource, 'volumes');
  assert.equal(id, 'my-volume');
  assert.equal(action, 'attach');
  assert.deepEqual(body, { hostId: 'mfth50', disableFrontend: true });
});

test('volume_delete propagates a client error as an isError result instead of throwing', async () => {
  const client = {
    delete: async () => {
      throw new Error('volume is still attached');
    },
  } as unknown as LonghornClient;

  const handler = captureHandler('volume_delete', client);
  const result = await handler({ name: 'my-volume' });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /volume is still attached/);
});

test('volume_delete succeeds cleanly when Longhorn returns an empty DELETE response body', async () => {
  // Verified live: Longhorn's DELETE /v1/volumes/{name} can return an empty
  // body, which LonghornClient.request() surfaces as `undefined` — this
  // used to break the tool's result (see tool-def.test.ts) because the
  // handler did textResult(JSON.stringify(undefined)), and
  // JSON.stringify(undefined) is the value undefined, not a string.
  const client = { delete: async () => undefined } as unknown as LonghornClient;

  const handler = captureHandler('volume_delete', client);
  const result = await handler({ name: 'my-volume' });

  assert.equal(result.isError, undefined);
  assert.equal(typeof result.content[0].text, 'string');
  assert.match(result.content[0].text, /Deleted volume "my-volume"/);
});
