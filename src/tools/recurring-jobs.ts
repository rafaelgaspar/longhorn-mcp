import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, textResult, withDocs, type ToolDef } from './tool-def.js';

const RESOURCE = 'recurringjobs';

export const tools: ToolDef[] = [
  defineTool(
    'recurringjob_list',
    false,
    { title: 'List recurring jobs', description: withDocs('List Longhorn recurring jobs.', DOCS.recurringJobs), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list(RESOURCE)),
  ),
  defineTool(
    'recurringjob_get',
    false,
    {
      title: 'Get recurring job',
      description: withDocs('Get a single recurring job by name.', DOCS.recurringJobs),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get(RESOURCE, name)),
  ),
  defineTool(
    'recurringjob_create',
    true,
    {
      title: 'Create recurring job',
      description: withDocs('Create a new Longhorn recurring job.', DOCS.recurringJobs),
      inputSchema: z.object({
        name: z.string(),
        task: z.string().describe('e.g. "snapshot", "backup", "snapshot-cleanup", "snapshot-delete", "filesystem-trim", "system-backup".'),
        cron: z.string().describe('Cron schedule expression.'),
        retain: z.number().int().min(0),
        concurrency: z.number().int().min(1),
        groups: z.array(z.string()).optional(),
        labels: z.record(z.string(), z.string()).optional(),
        parameters: z.record(z.string(), z.string()).optional(),
      }),
    },
    async (body, client) => jsonResult(await client.create(RESOURCE, body)),
  ),
  defineTool(
    'recurringjob_update',
    true,
    {
      title: 'Update recurring job',
      description: withDocs(
        destructive(
          'Update an existing Longhorn recurring job. Fields you omit are left unchanged (read-merge-write under the hood — the API itself does a full replace on PUT). Lowering `retain` can prune existing snapshots/backups beyond the new limit.',
        ),
        DOCS.recurringJobs,
      ),
      inputSchema: z.object({
        name: z.string(),
        task: z.string().optional(),
        cron: z.string().optional(),
        retain: z.number().int().min(0).optional(),
        concurrency: z.number().int().min(1).optional(),
        groups: z.array(z.string()).optional(),
        labels: z.record(z.string(), z.string()).optional(),
        parameters: z.record(z.string(), z.string()).optional(),
      }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.updateMerged(RESOURCE, name, body)),
  ),
  defineTool(
    'recurringjob_delete',
    true,
    {
      title: 'Delete recurring job',
      description: withDocs(destructive('Delete a Longhorn recurring job.'), DOCS.recurringJobs),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => textResult(JSON.stringify(await client.delete(RESOURCE, name))),
  ),
];
