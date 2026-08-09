import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, withDocs, type ToolDef } from './tool-def.js';

const RESOURCE = 'settings';

export const tools: ToolDef[] = [
  defineTool(
    'setting_list',
    false,
    { title: 'List settings', description: withDocs('List all Longhorn global settings.', DOCS.settings), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list(RESOURCE)),
  ),
  defineTool(
    'setting_get',
    false,
    {
      title: 'Get setting',
      description: withDocs('Get a single Longhorn setting by name.', DOCS.settings),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get(RESOURCE, name)),
  ),
  defineTool(
    'setting_update',
    true,
    {
      title: 'Update setting',
      description: withDocs(
        destructive('Update a Longhorn global setting value. Some settings (Longhorn\'s own "Danger Zone" category) affect every volume in the cluster.'),
        DOCS.settings,
      ),
      inputSchema: z.object({ name: z.string(), value: z.string() }),
    },
    async ({ name, value }, client) => jsonResult(await client.update(RESOURCE, name, { name, value })),
  ),
];
