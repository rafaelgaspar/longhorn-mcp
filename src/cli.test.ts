import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, parseArgs } from './cli.js';

test('parseArgs() returns defaults when given no flags', () => {
  const options = parseArgs([]);
  assert.deepEqual(options, DEFAULTS);
});

test('parseArgs() parses boolean flags', () => {
  const options = parseArgs(['--http', '--read-only']);
  assert.equal(options.http, true);
  assert.equal(options.readOnly, true);
});

test('parseArgs() parses space-separated and =-separated value flags identically', () => {
  const spaceForm = parseArgs(['--port', '4000', '--host', '127.0.0.1', '--longhorn-url', 'http://x:9500']);
  const eqForm = parseArgs(['--port=4000', '--host=127.0.0.1', '--longhorn-url=http://x:9500']);

  for (const options of [spaceForm, eqForm]) {
    assert.equal(options.port, 4000);
    assert.equal(options.host, '127.0.0.1');
    assert.equal(options.longhornUrl, 'http://x:9500');
  }
});

test('parseArgs() splits --allowed-hosts on commas and trims whitespace', () => {
  const options = parseArgs(['--allowed-hosts', 'a.example, b.example ,c.example']);
  assert.deepEqual(options.allowedHosts, ['a.example', 'b.example', 'c.example']);
});

test('parseArgs() does not mutate the shared DEFAULTS.allowedHosts array', () => {
  parseArgs(['--allowed-hosts', 'only-this-one.example']);
  assert.deepEqual(DEFAULTS.allowedHosts, ['localhost', '127.0.0.1']);
});

test('parseArgs() throws a clear error for a value flag with no trailing value, instead of silently swallowing it', () => {
  assert.throws(() => parseArgs(['--host']), /--host requires a value/);
  assert.throws(() => parseArgs(['--allowed-hosts']), /--allowed-hosts requires a value/);
});
