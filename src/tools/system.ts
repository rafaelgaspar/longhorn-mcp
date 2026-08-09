import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, textResult, withDocs, type ToolDef } from './tool-def.js';

export const tools: ToolDef[] = [
  // orphan: read-only in Longhorn's v1 API (resourceMethods is GET-only — no
  // delete action is exposed here even though the Longhorn UI can clean these up).
  defineTool(
    'orphan_list',
    false,
    {
      title: 'List orphans',
      description: withDocs('List orphaned replica/engine instance directories Longhorn has detected.', DOCS.orphanedDataCleanup),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list('orphans')),
  ),
  defineTool(
    'orphan_get',
    false,
    {
      title: 'Get orphan',
      description: withDocs('Get a single orphan record by id.', DOCS.orphanedDataCleanup),
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, client) => jsonResult(await client.get('orphans', id)),
  ),

  // supportBundle: read-only in Longhorn's v1 API (collectionMethods is
  // GET-only here — creation is not exposed via a plain POST /v1/supportbundles).
  defineTool(
    'supportbundle_list',
    false,
    { title: 'List support bundles', description: withDocs('List generated Longhorn support bundles.', DOCS.supportBundle), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('supportbundles')),
  ),
  defineTool(
    'supportbundle_get',
    false,
    {
      title: 'Get support bundle',
      description: withDocs('Get a single support bundle by id.', DOCS.supportBundle),
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, client) => jsonResult(await client.get('supportbundles', id)),
  ),

  defineTool(
    'systembackup_list',
    false,
    { title: 'List system backups', description: withDocs('List Longhorn system backups.', DOCS.systemBackupRestore), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('systembackups')),
  ),
  defineTool(
    'systembackup_get',
    false,
    {
      title: 'Get system backup',
      description: withDocs('Get a single system backup by name.', DOCS.systemBackupRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get('systembackups', name)),
  ),
  defineTool(
    'systembackup_create',
    true,
    {
      title: 'Create system backup',
      description: withDocs('Create a new Longhorn system backup.', DOCS.systemBackupRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.create('systembackups', { name })),
  ),
  defineTool(
    'systembackup_delete',
    true,
    {
      title: 'Delete system backup',
      description: withDocs(destructive('Delete a Longhorn system backup.'), DOCS.systemBackupRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => {
      await client.delete('systembackups', name);
      return textResult(`Deleted system backup "${name}".`);
    },
  ),

  defineTool(
    'systemrestore_list',
    false,
    { title: 'List system restores', description: withDocs('List Longhorn system restore operations.', DOCS.systemBackupRestore), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('systemrestores')),
  ),
  defineTool(
    'systemrestore_get',
    false,
    {
      title: 'Get system restore',
      description: withDocs('Get a single system restore by name.', DOCS.systemBackupRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get('systemrestores', name)),
  ),
  defineTool(
    'systemrestore_create',
    true,
    {
      title: 'Create system restore',
      description: withDocs(destructive('Restore the Longhorn system from a system backup — restores cluster-wide Longhorn state.'), DOCS.systemBackupRestore),
      inputSchema: z.object({ name: z.string(), systemBackup: z.string() }),
    },
    async (body, client) => jsonResult(await client.create('systemrestores', body)),
  ),
  defineTool(
    'systemrestore_delete',
    true,
    {
      title: 'Delete system restore',
      description: withDocs(destructive('Delete a Longhorn system restore record.'), DOCS.systemBackupRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => {
      await client.delete('systemrestores', name);
      return textResult(`Deleted system restore "${name}".`);
    },
  ),

  defineTool(
    'volumeattachment_list',
    false,
    { title: 'List volume attachments', description: 'List Longhorn VolumeAttachment records (attachment tickets per volume).', inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('volumeattachments')),
  ),
  defineTool(
    'volumeattachment_get',
    false,
    { title: 'Get volume attachment', description: 'Get a single VolumeAttachment record by name.', inputSchema: z.object({ name: z.string() }) },
    async ({ name }, client) => jsonResult(await client.get('volumeattachments', name)),
  ),

  defineTool(
    'longhorn_list_tags',
    false,
    {
      title: 'List tags',
      description: withDocs('List node/disk/backing-image tags known to Longhorn, optionally filtered by type.', DOCS.nodes),
      inputSchema: z.object({ type: z.enum(['node', 'disk', 'backingimage']).optional() }),
    },
    async ({ type }, client) => jsonResult(await client.request('GET', type ? `/v1/tags?type=${encodeURIComponent(type)}` : '/v1/tags')),
  ),

  defineTool(
    'longhorn_events',
    false,
    { title: 'List events', description: 'List Kubernetes events Longhorn has recorded against its own resources.', inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('events')),
  ),
];
