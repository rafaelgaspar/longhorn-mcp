import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, withDocs, type ToolDef } from './tool-def.js';

const RESOURCE = 'nodes';

export const tools: ToolDef[] = [
  defineTool(
    'node_list',
    false,
    {
      title: 'List nodes',
      description: withDocs('List Longhorn node records (scheduling state, disks, conditions).', DOCS.nodes),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list(RESOURCE)),
  ),
  defineTool(
    'node_get',
    false,
    { title: 'Get node', description: withDocs('Get a single Longhorn node record by name.', DOCS.nodes), inputSchema: z.object({ name: z.string() }) },
    async ({ name }, client) => jsonResult(await client.get(RESOURCE, name)),
  ),
  defineTool(
    'node_update',
    true,
    {
      title: 'Update node',
      description: withDocs(
        destructive(
          'Update a Longhorn node record (e.g. allowScheduling, evictionRequested, tags). Fields you omit are left unchanged (read-merge-write under the hood — the API itself does a full replace on PUT). `evictionRequested: true` drains all replicas/backing images off the node.',
        ),
        DOCS.nodes,
      ),
      inputSchema: z.object({
        name: z.string(),
        allowScheduling: z.boolean().optional(),
        evictionRequested: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.updateMerged(RESOURCE, name, body)),
  ),
  defineTool(
    'node_disk_update',
    true,
    {
      title: 'Update node disks',
      description: withDocs(
        destructive(
          'Update the disk configuration for a node. `disks` is the raw array of Longhorn Disk objects (path, allowScheduling, storageReserved, tags, diskType, ...) — inspect the node via node_get first to see the current shape. Disabling scheduling or shrinking storageReserved on a disk can strand replicas.',
        ),
        DOCS.nodes,
      ),
      inputSchema: z.object({ name: z.string(), disks: z.array(z.record(z.string(), z.unknown())) }),
    },
    async ({ name, disks }, client) => jsonResult(await client.action(RESOURCE, name, 'diskUpdate', { disks })),
  ),
];
