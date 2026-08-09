import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/server';
import type { LonghornClient } from '../longhorn/client.js';
import { ALL_TOOLS, registerAllTools } from './index.js';

function fakeServer(): { server: McpServer; registered: string[] } {
  const registered: string[] = [];
  const server = {
    registerTool(name: string) {
      registered.push(name);
    },
  } as unknown as McpServer;
  return { server, registered };
}

const fakeClient = {} as unknown as LonghornClient;

test('registerAllTools() advertises every tool when not read-only', () => {
  const { server, registered } = fakeServer();
  registerAllTools(server, fakeClient, { readOnly: false });

  assert.equal(registered.length, ALL_TOOLS.length);
  // Spot-check a known write tool is present.
  assert.ok(registered.includes('volume_delete'));
});

test('registerAllTools() skips every write:true tool when read-only', () => {
  const { server, registered } = fakeServer();
  registerAllTools(server, fakeClient, { readOnly: true });

  const writeToolNames = new Set(ALL_TOOLS.filter((t) => t.write).map((t) => t.name));
  const readToolNames = new Set(ALL_TOOLS.filter((t) => !t.write).map((t) => t.name));

  assert.ok(writeToolNames.size > 0, 'sanity check: there must be at least one write tool to actually test filtering');
  for (const name of registered) {
    assert.ok(!writeToolNames.has(name), `${name} is a write tool and must not be registered in read-only mode`);
  }
  assert.equal(registered.length, readToolNames.size);
});

test('every tool name is unique', () => {
  const names = ALL_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
});
