import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, textResult, withDocs, type ToolDef } from './tool-def.js';

const extraField = z
  .record(z.string(), z.unknown())
  .optional()
  .describe('Additional Longhorn fields, merged verbatim into the request body.');

export const tools: ToolDef[] = [
  // backup: plain read-only resource (GET list/get only — deletion happens via backupvolume_backup_delete).
  defineTool(
    'backup_list',
    false,
    {
      title: 'List backups',
      description: withDocs('List all backups across all backup volumes (plain read-only GET — available in --read-only mode).', DOCS.backupAndRestore),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list('backups')),
  ),
  defineTool(
    'backup_get',
    false,
    {
      title: 'Get backup',
      description: withDocs('Get a single backup by id (plain read-only GET — available in --read-only mode).', DOCS.backupAndRestore),
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, client) => jsonResult(await client.get('backups', id)),
  ),

  // backupvolume: CRUD + RPC actions scoping backups to a volume.
  defineTool(
    'backupvolume_list',
    false,
    {
      title: 'List backup volumes',
      description: withDocs('List Longhorn backup volumes (backup-target-side volume records).', DOCS.backupAndRestore),
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.list('backupvolumes')),
  ),
  defineTool(
    'backupvolume_get',
    false,
    {
      title: 'Get backup volume',
      description: withDocs('Get a single backup volume by name.', DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get('backupvolumes', name)),
  ),
  defineTool(
    'backupvolume_update',
    true,
    {
      title: 'Update backup volume',
      description: withDocs(
        'Update a backup volume record. Fields you omit are left unchanged (read-merge-write under the hood — the API itself does a full replace on PUT).',
        DOCS.backupAndRestore,
      ),
      inputSchema: z.object({ name: z.string(), extra: extraField }),
    },
    async ({ name, extra }, client) => jsonResult(await client.updateMerged('backupvolumes', name, extra ?? {})),
  ),
  defineTool(
    'backupvolume_delete',
    true,
    {
      title: 'Delete backup volume',
      description: withDocs(destructive('Delete a backup volume record from the backup target.'), DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => textResult(JSON.stringify(await client.delete('backupvolumes', name))),
  ),
  defineTool(
    'backupvolume_backup_delete',
    true,
    {
      title: 'Delete backup',
      description: withDocs(destructive('Delete a specific backup belonging to a backup volume.'), DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string(), backupName: z.string() }),
    },
    async ({ name, backupName }, client) => jsonResult(await client.action('backupvolumes', name, 'backupDelete', { name: backupName })),
  ),
  defineTool(
    'backupvolume_backup_get',
    true,
    {
      title: 'Get backup (via backup volume)',
      description: withDocs(
        'Get a specific backup belonging to a backup volume via the volume-scoped action (requires write access — use backup_get for read-only introspection).',
        DOCS.backupAndRestore,
      ),
      inputSchema: z.object({ name: z.string(), backupName: z.string() }),
    },
    async ({ name, backupName }, client) => jsonResult(await client.action('backupvolumes', name, 'backupGet', { name: backupName })),
  ),
  defineTool(
    'backupvolume_backup_list',
    true,
    {
      title: 'List backups (via backup volume)',
      description: withDocs(
        'List backups belonging to a backup volume via the volume-scoped action (requires write access — use backup_list for read-only introspection).',
        DOCS.backupAndRestore,
      ),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action('backupvolumes', name, 'backupList')),
  ),
  defineTool(
    'backupvolume_backup_list_by_volume',
    true,
    {
      title: 'List backups by volume',
      description: withDocs('List backups for a backup volume, scoped by the source volume.', DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action('backupvolumes', name, 'backupListByVolume')),
  ),
  defineTool(
    'backupvolume_sync',
    true,
    {
      title: 'Sync backup volume',
      description: withDocs('Force a resync of a backup volume against the backup target.', DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action('backupvolumes', name, 'backupVolumeSync')),
  ),

  // backuptarget: CRUD + sync/update actions.
  defineTool(
    'backuptarget_list',
    false,
    { title: 'List backup targets', description: withDocs('List configured backup targets.', DOCS.backupAndRestore), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list('backuptargets')),
  ),
  defineTool(
    'backuptarget_get',
    false,
    {
      title: 'Get backup target',
      description: withDocs('Get a single backup target by name.', DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.get('backuptargets', name)),
  ),
  defineTool(
    'backuptarget_create',
    true,
    {
      title: 'Create backup target',
      description: withDocs('Create a new backup target.', DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string(), extra: extraField }),
    },
    async ({ name, extra }, client) => jsonResult(await client.create('backuptargets', { ...extra, name })),
  ),
  defineTool(
    'backuptarget_update',
    true,
    {
      title: 'Update backup target',
      description: withDocs(
        destructive(
          'Update a backup target (e.g. backupTargetURL, credentialSecret, pollInterval). Fields you omit are left unchanged (read-merge-write under the hood — the API itself does a full replace on PUT). Repointing backupTargetURL changes where future backups go and can break restore access to existing ones.',
        ),
        DOCS.backupAndRestore,
      ),
      inputSchema: z.object({
        name: z.string(),
        backupTargetURL: z.string().optional(),
        credentialSecret: z.string().optional(),
        pollInterval: z.string().optional(),
        extra: extraField,
      }),
    },
    async ({ name, extra, ...body }, client) => jsonResult(await client.updateMerged('backuptargets', name, { ...extra, ...body })),
  ),
  defineTool(
    'backuptarget_delete',
    true,
    {
      title: 'Delete backup target',
      description: withDocs(destructive('Delete a backup target.'), DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => textResult(JSON.stringify(await client.delete('backuptargets', name))),
  ),
  defineTool(
    'backuptarget_sync',
    true,
    {
      title: 'Sync backup target',
      description: withDocs('Force Longhorn to resync backup target/backup volume state.', DOCS.backupAndRestore),
      inputSchema: z.object({
        name: z.string(),
        syncAllBackupTargets: z.boolean().optional(),
        syncAllBackupVolumes: z.boolean().optional(),
        syncBackupTarget: z.boolean().optional(),
        syncBackupVolume: z.boolean().optional(),
      }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action('backuptargets', name, 'backupTargetSync', body)),
  ),
  defineTool(
    'backuptarget_update_name',
    true,
    {
      title: 'Update backup target name reference',
      description: withDocs(destructive('Update the backupTargetName reference on a backup target record.'), DOCS.backupAndRestore),
      inputSchema: z.object({ name: z.string(), backupTargetName: z.string() }),
    },
    async ({ name, backupTargetName }, client) => jsonResult(await client.action('backuptargets', name, 'backupTargetUpdate', { backupTargetName })),
  ),
];
