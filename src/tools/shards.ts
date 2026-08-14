import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, jsonResult, withDocs, type ToolDef } from './tool-def.js';

// shard / shardGroup: Longhorn 1.12.1's experimental V2 data engine storage
// sharding (erasure-coded volumes). Both are read-only in Longhorn's v1 API
// (resourceMethods is GET-only, resourceActions is empty) — they're
// server-computed status objects describing shard placement/rebuild state,
// not resources a client creates, updates, or deletes directly.
export const tools: ToolDef[] = [
  defineTool(
    'shard_list',
    false,
    {
      title: 'List shards',
      description: withDocs('List erasure-coded shards backing V2 data engine sharded volumes (experimental feature).', DOCS.sharding),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list('shards')),
  ),
  defineTool(
    'shard_get',
    false,
    {
      title: 'Get shard',
      description: withDocs('Get a single shard by id.', DOCS.sharding),
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, client) => jsonResult(await client.get('shards', id)),
  ),

  defineTool(
    'shardgroup_list',
    false,
    {
      title: 'List shard groups',
      description: withDocs(
        'List shard groups (erasure-coding sets of shards) backing V2 data engine sharded volumes (experimental feature).',
        DOCS.sharding,
      ),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list('shardgroups')),
  ),
  defineTool(
    'shardgroup_get',
    false,
    {
      title: 'Get shard group',
      description: withDocs('Get a single shard group by id.', DOCS.sharding),
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, client) => jsonResult(await client.get('shardgroups', id)),
  ),
];
