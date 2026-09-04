import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translateActions } from './action-links.js';
// Side-effect imports: defineTool() (tool-def.ts) registers each tool's
// compact parameter shape into tool-registry.ts as these modules'
// module-level `tools` arrays are built. translateActions() reads that
// registry, so the tools it needs shapes for here must be imported first.
import './nodes.js';
import './raw.js';
import './volumes.js';

test('translateActions rewrites a resource action URL into its covering MCP tool name, with that tool\'s parameter shape', () => {
  const volume = {
    id: 'my-volume',
    type: 'volume',
    actions: {
      attach: 'http://longhorn-backend:9500/v1/volumes/my-volume?action=attach',
      snapshotCreate: 'http://longhorn-backend:9500/v1/volumes/my-volume?action=snapshotCreate',
    },
  };

  const result = translateActions(volume) as { actions: Record<string, unknown> };

  assert.deepEqual(result.actions.attach, {
    tool: 'volume_attach',
    shape: { name: 'string', hostId: 'string', disableFrontend: 'boolean?', attachedBy: 'string?', attacherType: 'string?', attachmentID: 'string?' },
  });
  assert.deepEqual(result.actions.snapshotCreate, {
    tool: 'volume_snapshot_create',
    shape: { name: 'string', snapshotName: 'string?', labels: 'object?', backupMode: 'string?' },
  });
});

test('translateActions maps a volume updateXxx action to volume_update_setting, with `args.setting` pinned and still present in `shape`', () => {
  const volume = {
    id: 'my-volume',
    type: 'volume',
    actions: { updateReplicaCount: 'http://longhorn-backend:9500/v1/volumes/my-volume?action=updateReplicaCount' },
  };

  const result = translateActions(volume) as { actions: Record<string, unknown> };

  // `shape` lists every volume_update_setting parameter, including
  // `setting` (already pinned via `args`) — so a reader can always resolve
  // `args.setting` against `shape` without a separate schema lookup.
  assert.deepEqual(result.actions.updateReplicaCount, {
    tool: 'volume_update_setting',
    shape: { name: 'string', setting: 'enum(19 values)', value: 'string|number|boolean' },
    args: { setting: 'replicaCount' },
  });
});

test('translateActions falls back to longhorn_raw_request, pinning method+path, for an action no tool covers', () => {
  // "fooBar" isn't a real Longhorn action — every real one is mapped to a
  // tool (see ACTION_TOOL_MAP) — this only exercises the safety-net branch.
  const volume = {
    id: 'my-volume',
    type: 'volume',
    actions: { fooBar: 'http://longhorn-backend:9500/v1/volumes/my-volume?action=fooBar' },
  };

  const result = translateActions(volume) as { actions: Record<string, unknown> };

  assert.deepEqual(result.actions.fooBar, {
    tool: 'longhorn_raw_request',
    shape: { method: 'enum(GET|POST|PUT|DELETE)', path: 'string', body: 'object?' },
    args: { method: 'POST', path: '/v1/volumes/my-volume?action=fooBar' },
  });
});

test('translateActions maps volume\'s "jobList" action to volume_job_list', () => {
  const volume = {
    id: 'my-volume',
    type: 'volume',
    actions: { jobList: 'http://longhorn-backend:9500/v1/volumes/my-volume?action=jobList' },
  };

  const result = translateActions(volume) as { actions: Record<string, unknown> };

  assert.deepEqual(result.actions.jobList, { tool: 'volume_job_list', shape: { name: 'string', extra: 'object?' } });
});

test('translateActions recurses into collection responses ({ data: [...] })', () => {
  const collection = {
    type: 'collection',
    data: [
      { id: 'node-1', type: 'node', actions: { diskUpdate: 'http://longhorn-backend:9500/v1/nodes/node-1?action=diskUpdate' } },
      { id: 'node-2', type: 'node', actions: {} },
    ],
  };

  const result = translateActions(collection) as { data: { actions: Record<string, unknown> }[] };

  assert.deepEqual(result.data[0].actions.diskUpdate, { tool: 'node_disk_update', shape: { name: 'string', disks: 'object[]' } });
  assert.deepEqual(result.data[1].actions, {});
});

test('translateActions leaves an actions map untouched when there is no sibling `type` field', () => {
  const value = { actions: { attach: 'http://longhorn-backend:9500/v1/volumes/x?action=attach' } };

  const result = translateActions(value) as { actions: unknown };

  assert.deepEqual(result.actions, value.actions);
});

test('translateActions passes non-resource values through unchanged', () => {
  assert.equal(translateActions('plain string'), 'plain string');
  assert.equal(translateActions(42), 42);
  assert.equal(translateActions(null), null);
  assert.equal(translateActions(undefined), undefined);
});
