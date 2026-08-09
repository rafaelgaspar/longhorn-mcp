#!/usr/bin/env -S npx tsx
/**
 * Dev-time helper: dumps Longhorn's live /v1/schemas against a running
 * manager, for cross-checking the hand-written tool coverage in
 * src/tools/*.ts against the actual deployed Longhorn version. Not part of
 * the published package.
 *
 * Usage (against a port-forwarded or in-cluster Longhorn manager):
 *   npm run introspect-schema -- http://localhost:9500
 *   npm run introspect-schema -- http://localhost:9500 volume
 */
import { LonghornClient } from '../src/longhorn/client.js';
import type { LonghornSchema } from '../src/longhorn/types.js';

const [baseUrl = 'http://localhost:9500', resourceId] = process.argv.slice(2);
const client = new LonghornClient({ baseUrl, readOnly: true });

async function main(): Promise<void> {
  if (resourceId) {
    const schema = await client.schema<LonghornSchema>(resourceId);
    console.log(JSON.stringify(schema, null, 2));
    return;
  }

  const { data } = await client.schemas<{ data: LonghornSchema[] }>();
  for (const schema of data) {
    const actions = Object.keys(schema.resourceActions ?? {});
    console.log(
      `${schema.id}  collection=[${(schema.collectionMethods ?? []).join(',')}]  resource=[${(schema.resourceMethods ?? []).join(',')}]${
        actions.length ? `  actions=[${actions.join(',')}]` : ''
      }`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
