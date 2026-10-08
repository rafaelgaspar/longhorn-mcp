import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, textResult, withDocs, type ToolDef } from './tool-def.js';

const RESOURCE = 'snapshotgroups';

const labelSelectorRequirementSchema = z.object({
  key: z.string(),
  operator: z.string(),
  values: z.array(z.string()).optional(),
});

const labelSelectorSchema = z.object({
  matchLabels: z.record(z.string(), z.string()).optional(),
  matchExpressions: z.array(labelSelectorRequirementSchema).optional(),
});

export const tools: ToolDef[] = [
  defineTool(
    'snapshotgroup_list',
    false,
    {
      title: 'List snapshot groups',
      description: withDocs('List Longhorn snapshot groups (coordinated multi-volume snapshots introduced in Longhorn 1.13.0).', DOCS.snapshotGroups),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list(RESOURCE)),
  ),
  defineTool(
    'snapshotgroup_get',
    false,
    {
      title: 'Get snapshot group',
      description: withDocs('Get a single snapshot group by name.', DOCS.snapshotGroups),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get(RESOURCE, name)),
  ),
  defineTool(
    'snapshotgroup_create',
    true,
    {
      title: 'Create snapshot group',
      description: withDocs(
        'Create a snapshot group that snapshots multiple volumes together. Set exactly one of `volumes` (explicit volume names) or `volumeSelector` (label query) — not both, not neither.',
        DOCS.snapshotGroups,
      ),
      inputSchema: z.object({
        name: z.string(),
        volumes: z.array(z.string()).optional(),
        volumeSelector: labelSelectorSchema.optional(),
        labels: z.record(z.string(), z.string()).optional(),
        deadlineSeconds: z.number().int().min(0).optional(),
      }),
    },
    async (body, client) => jsonResult(await client.create(RESOURCE, body)),
  ),
  defineTool(
    'snapshotgroup_delete',
    true,
    {
      title: 'Delete snapshot group',
      description: withDocs(destructive('Delete a Longhorn snapshot group.'), DOCS.snapshotGroups),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => {
      await client.delete(RESOURCE, name);
      return textResult(`Deleted snapshot group "${name}".`);
    },
  ),
  defineTool(
    'snapshotgroup_preview',
    true,
    {
      title: 'Preview snapshot group members',
      description: withDocs(
        'Dry-run which volumes would be included in a snapshot group for the given `volumes` or `volumeSelector` (collection `preview` action — POST, so unavailable in --read-only mode). Set exactly one of those fields.',
        DOCS.snapshotGroups,
      ),
      inputSchema: z.object({
        volumes: z.array(z.string()).optional(),
        volumeSelector: labelSelectorSchema.optional(),
      }),
    },
    async (body, client) => jsonResult(await client.collectionAction(RESOURCE, 'preview', body)),
  ),
];
