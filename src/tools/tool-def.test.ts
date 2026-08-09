import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsonResult } from './tool-def.js';

test('jsonResult(undefined) returns a valid string-content result instead of a broken one', () => {
  // JSON.stringify(undefined) returns the *value* undefined, not a string —
  // TypeScript's lib.d.ts types JSON.stringify as always returning `string`,
  // so tsc doesn't catch this. Found live: Longhorn's DELETE endpoints often
  // return an empty body, which LonghornClient.request() surfaces as
  // `undefined`, and jsonResult(undefined) used to produce
  // `{ content: [{ type: 'text', text: undefined }] }` — a result the MCP
  // SDK rejects with a schema validation error at the transport layer.
  const result = jsonResult(undefined);
  assert.equal(typeof result.content[0].text, 'string');
  assert.equal(result.content[0].text, '(empty response body)');
});

test('jsonResult() still round-trips real data normally', () => {
  const result = jsonResult({ id: 'vol-1', size: '16Gi' });
  assert.deepEqual(JSON.parse(result.content[0].text), { id: 'vol-1', size: '16Gi' });
});
