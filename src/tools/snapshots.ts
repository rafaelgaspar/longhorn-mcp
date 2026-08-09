import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, jsonResult, withDocs, type ToolDef } from './tool-def.js';

const RESOURCE = 'snapshots';

export const tools: ToolDef[] = [
  defineTool(
    'snapshot_list',
    false,
    {
      title: 'List snapshots',
      description: withDocs('List all snapshots across all volumes (plain read-only GET — available in --read-only mode).', DOCS.snapshots),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list(RESOURCE)),
  ),

  defineTool(
    'snapshot_get',
    false,
    {
      title: 'Get snapshot',
      description: withDocs('Get a single snapshot by id (plain read-only GET — available in --read-only mode).', DOCS.snapshots),
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, client) => jsonResult(await client.get(RESOURCE, id)),
  ),
];
