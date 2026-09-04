import * as z from 'zod/v4';
import { DOCS } from '../longhorn/docs.js';
import { defineTool, destructive, jsonResult, textResult, withDocs, type ToolDef } from './tool-def.js';
import { VOLUME_SETTINGS, VOLUME_SETTING_ACTION } from './volume-settings.js';

const RESOURCE = 'volumes';

const extraField = z
  .record(z.string(), z.unknown())
  .optional()
  .describe('Additional Longhorn fields not covered by the named parameters above, merged verbatim into the request body.');

export const tools: ToolDef[] = [
  defineTool(
    'volume_list',
    false,
    { title: 'List volumes', description: withDocs('List all Longhorn volumes.', DOCS.volumes), inputSchema: z.object({}) },
    async (_args, client) => jsonResult(await client.list(RESOURCE)),
  ),

  defineTool(
    'volume_get',
    false,
    { title: 'Get volume', description: withDocs('Get a single Longhorn volume by name.', DOCS.volumes), inputSchema: z.object({ name: z.string() }) },
    async ({ name }, client) => jsonResult(await client.get(RESOURCE, name)),
  ),

  defineTool(
    'volume_create',
    true,
    {
      title: 'Create volume',
      description: withDocs('Create a new Longhorn volume.', DOCS.volumes),
      inputSchema: z.object({
        name: z.string(),
        size: z.string().describe('Bytes, or a size string like "10Gi".'),
        numberOfReplicas: z.number().int().min(1),
        frontend: z.string().optional().describe('e.g. "blockdev" or "iscsi".'),
        dataLocality: z.string().optional(),
        accessMode: z.string().optional().describe('"rwo" or "rwx".'),
        fromBackup: z.string().optional().describe('Backup URL to restore from.'),
        backingImage: z.string().optional(),
        staleReplicaTimeout: z.number().int().optional(),
        diskSelector: z.array(z.string()).optional(),
        nodeSelector: z.array(z.string()).optional(),
        extra: extraField,
      }),
    },
    async ({ extra, ...body }, client) => jsonResult(await client.create(RESOURCE, { ...extra, ...body })),
  ),

  defineTool(
    'volume_delete',
    true,
    { title: 'Delete volume', description: withDocs(destructive('Delete a Longhorn volume.'), DOCS.volumes), inputSchema: z.object({ name: z.string() }) },
    async ({ name }, client) => {
      await client.delete(RESOURCE, name);
      return textResult(`Deleted volume "${name}".`);
    },
  ),

  defineTool(
    'volume_attach',
    true,
    {
      title: 'Attach volume',
      description: withDocs('Attach a volume to a node.', DOCS.volumes),
      inputSchema: z.object({
        name: z.string(),
        hostId: z.string().describe('Node name to attach to.'),
        disableFrontend: z.boolean().optional(),
        attachedBy: z.string().optional(),
        attacherType: z.string().optional(),
        attachmentID: z.string().optional(),
      }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action(RESOURCE, name, 'attach', body)),
  ),

  defineTool(
    'volume_detach',
    true,
    {
      title: 'Detach volume',
      description: withDocs(
        destructive('Detach a volume. `forceDetach: true` risks data corruption if the volume is mid-write.'),
        DOCS.volumes,
      ),
      inputSchema: z.object({
        name: z.string(),
        hostId: z.string().optional(),
        forceDetach: z.boolean().optional(),
        attachmentID: z.string().optional(),
      }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action(RESOURCE, name, 'detach', body)),
  ),

  defineTool(
    'volume_activate',
    true,
    {
      title: 'Activate volume',
      description: withDocs('Activate a standby (DR) volume.', DOCS.disasterRecovery),
      inputSchema: z.object({ name: z.string(), frontend: z.string().optional() }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action(RESOURCE, name, 'activate', body)),
  ),

  defineTool(
    'volume_expand',
    true,
    {
      title: 'Expand volume',
      description: withDocs('Expand a volume to a new size.', DOCS.volumes),
      inputSchema: z.object({ name: z.string(), size: z.string() }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action(RESOURCE, name, 'expand', body)),
  ),

  defineTool(
    'volume_cancel_expansion',
    true,
    {
      title: 'Cancel volume expansion',
      description: withDocs('Cancel an in-progress volume expansion.', DOCS.volumes),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action(RESOURCE, name, 'cancelExpansion')),
  ),

  defineTool(
    'volume_engine_upgrade',
    true,
    {
      title: 'Upgrade volume engine image',
      description: withDocs(
        destructive('Upgrade the engine image used by a volume. `image` is not validated against a known-good list — a bad image can make the volume inoperable.'),
        DOCS.upgrade,
      ),
      inputSchema: z.object({ name: z.string(), image: z.string() }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action(RESOURCE, name, 'engineUpgrade', body)),
  ),

  defineTool(
    'volume_salvage',
    true,
    {
      title: 'Salvage volume',
      description: withDocs(destructive('Salvage a volume from a list of (potentially stale) replica names.'), DOCS.volumes),
      inputSchema: z.object({ name: z.string(), replicaNames: z.array(z.string()) }),
    },
    async ({ name, replicaNames }, client) => jsonResult(await client.action(RESOURCE, name, 'salvage', { names: replicaNames })),
  ),

  defineTool(
    'volume_replica_remove',
    true,
    {
      title: 'Remove volume replica',
      description: withDocs(destructive('Remove a specific replica from a volume.'), DOCS.volumes),
      inputSchema: z.object({ name: z.string(), replicaName: z.string() }),
    },
    async ({ name, replicaName }, client) => jsonResult(await client.action(RESOURCE, name, 'replicaRemove', { name: replicaName })),
  ),

  defineTool(
    'volume_trim_filesystem',
    true,
    {
      title: 'Trim volume filesystem',
      description: withDocs('Trim the filesystem on a volume.', DOCS.volumes),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action(RESOURCE, name, 'trimFilesystem')),
  ),

  defineTool(
    'volume_job_list',
    true,
    {
      title: 'List volume jobs',
      description:
        'List a volume\'s background async jobs via its "jobList" action. Longhorn does not publish a dedicated input or output schema for this action in /v1/schemas, and it has no corresponding docs page — use longhorn_describe_resource_type(\'volume\') to check the deployed version\'s exact shape, or pass fields via extra.',
      inputSchema: z.object({ name: z.string(), extra: extraField }),
    },
    async ({ name, extra }, client) => jsonResult(await client.action(RESOURCE, name, 'jobList', extra)),
  ),

  defineTool(
    'volume_update_setting',
    true,
    {
      title: 'Update a volume setting',
      description: withDocs(
        `Update one of Longhorn's per-volume settings. Valid "setting" values: ${Object.keys(VOLUME_SETTINGS).join(', ')}.`,
        DOCS.volumes,
      ),
      inputSchema: z.object({
        name: z.string(),
        setting: z.enum(Object.keys(VOLUME_SETTINGS) as [string, ...string[]]),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    },
    async ({ name, setting, value }, client) => {
      const field = VOLUME_SETTINGS[setting];
      const action = VOLUME_SETTING_ACTION[setting];
      return jsonResult(await client.action(RESOURCE, name, action, { [field]: value }));
    },
  ),

  defineTool(
    'volume_snapshot_create',
    true,
    {
      title: 'Create volume snapshot',
      description: withDocs('Create a snapshot of a volume.', DOCS.snapshots),
      inputSchema: z.object({
        name: z.string(),
        snapshotName: z.string().optional(),
        labels: z.record(z.string(), z.string()).optional(),
        backupMode: z.string().optional(),
      }),
    },
    async ({ name, snapshotName, ...body }, client) =>
      jsonResult(await client.action(RESOURCE, name, 'snapshotCreate', { name: snapshotName, ...body })),
  ),

  defineTool(
    'volume_snapshot_list',
    true,
    {
      title: 'List volume snapshots',
      description: withDocs(
        'List snapshots for a volume via the volume-scoped action (requires write access — use snapshot_list for read-only introspection).',
        DOCS.snapshots,
      ),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotList')),
  ),

  defineTool(
    'volume_snapshot_get',
    true,
    {
      title: 'Get volume snapshot',
      description: withDocs(
        'Get one snapshot of a volume via the volume-scoped action (requires write access — use snapshot_get for read-only introspection).',
        DOCS.snapshots,
      ),
      inputSchema: z.object({ name: z.string(), snapshotName: z.string() }),
    },
    async ({ name, snapshotName }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotGet', { name: snapshotName })),
  ),

  defineTool(
    'volume_snapshot_delete',
    true,
    {
      title: 'Delete volume snapshot',
      description: withDocs(destructive('Delete a snapshot of a volume.'), DOCS.snapshots),
      inputSchema: z.object({ name: z.string(), snapshotName: z.string() }),
    },
    async ({ name, snapshotName }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotDelete', { name: snapshotName })),
  ),

  defineTool(
    'volume_snapshot_revert',
    true,
    {
      title: 'Revert volume to snapshot',
      description: withDocs(destructive('Revert a volume to a snapshot, discarding all changes made since.'), DOCS.snapshots),
      inputSchema: z.object({ name: z.string(), snapshotName: z.string() }),
    },
    async ({ name, snapshotName }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotRevert', { name: snapshotName })),
  ),

  defineTool(
    'volume_snapshot_purge',
    true,
    {
      title: 'Purge volume snapshots',
      description: withDocs(destructive('Purge removed snapshots of a volume.'), DOCS.snapshots),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotPurge')),
  ),

  defineTool(
    'volume_snapshot_backup',
    true,
    {
      title: 'Back up a volume snapshot',
      description: withDocs('Create a backup from a volume snapshot.', DOCS.backupAndRestore),
      inputSchema: z.object({
        name: z.string(),
        snapshotName: z.string().optional(),
        labels: z.record(z.string(), z.string()).optional(),
        backupMode: z.string().optional(),
      }),
    },
    async ({ name, snapshotName, ...body }, client) =>
      jsonResult(await client.action(RESOURCE, name, 'snapshotBackup', { name: snapshotName, ...body })),
  ),

  defineTool(
    'volume_snapshot_cr_create',
    true,
    {
      title: 'Create VolumeSnapshot CR',
      description: withDocs(
        'Create a snapshot via the newer VolumeSnapshot CRD-backed action (equivalent to volume_snapshot_create).',
        DOCS.snapshots,
      ),
      inputSchema: z.object({ name: z.string(), snapshotName: z.string().optional(), labels: z.record(z.string(), z.string()).optional() }),
    },
    async ({ name, snapshotName, labels }, client) =>
      jsonResult(await client.action(RESOURCE, name, 'snapshotCRCreate', { name: snapshotName, labels })),
  ),

  defineTool(
    'volume_snapshot_cr_list',
    true,
    {
      title: 'List VolumeSnapshot CRs',
      description: withDocs('List CRD-backed snapshots for a volume.', DOCS.snapshots),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotCRList')),
  ),

  defineTool(
    'volume_snapshot_cr_get',
    true,
    {
      title: 'Get VolumeSnapshot CR',
      description: withDocs('Get one CRD-backed snapshot for a volume.', DOCS.snapshots),
      inputSchema: z.object({ name: z.string(), snapshotName: z.string() }),
    },
    async ({ name, snapshotName }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotCRGet', { name: snapshotName })),
  ),

  defineTool(
    'volume_snapshot_cr_delete',
    true,
    {
      title: 'Delete VolumeSnapshot CR',
      description: withDocs(destructive('Delete a CRD-backed snapshot for a volume.'), DOCS.snapshots),
      inputSchema: z.object({ name: z.string(), snapshotName: z.string() }),
    },
    async ({ name, snapshotName }, client) => jsonResult(await client.action(RESOURCE, name, 'snapshotCRDelete', { name: snapshotName })),
  ),

  defineTool(
    'volume_recurring_job_add',
    true,
    {
      title: 'Add recurring job to volume',
      description: withDocs('Attach a recurring job (or job group) to a volume.', DOCS.recurringJobs),
      inputSchema: z.object({ name: z.string(), jobName: z.string(), isGroup: z.boolean().optional() }),
    },
    async ({ name, jobName, isGroup }, client) =>
      jsonResult(await client.action(RESOURCE, name, 'recurringJobAdd', { name: jobName, isGroup })),
  ),

  defineTool(
    'volume_recurring_job_delete',
    true,
    {
      title: 'Remove recurring job from volume',
      description: withDocs(
        destructive('Detach a recurring job (or job group) from a volume — this can remove the volume\'s only backup/snapshot schedule.'),
        DOCS.recurringJobs,
      ),
      inputSchema: z.object({ name: z.string(), jobName: z.string(), isGroup: z.boolean().optional() }),
    },
    async ({ name, jobName, isGroup }, client) =>
      jsonResult(await client.action(RESOURCE, name, 'recurringJobDelete', { name: jobName, isGroup })),
  ),

  defineTool(
    'volume_recurring_job_list',
    true,
    {
      title: 'List volume recurring jobs',
      description: withDocs('List recurring jobs attached to a volume.', DOCS.recurringJobs),
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }, client) => jsonResult(await client.action(RESOURCE, name, 'recurringJobList')),
  ),

  defineTool(
    'volume_pv_create',
    true,
    {
      title: 'Create PersistentVolume for volume',
      description: withDocs('Create a Kubernetes PersistentVolume backed by this Longhorn volume.', DOCS.volumes),
      inputSchema: z.object({
        name: z.string(),
        pvName: z.string().optional(),
        fsType: z.string().optional(),
        secretName: z.string().optional(),
        secretNamespace: z.string().optional(),
        storageClassName: z.string().optional(),
      }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action(RESOURCE, name, 'pvCreate', body)),
  ),

  defineTool(
    'volume_pvc_create',
    true,
    {
      title: 'Create PersistentVolumeClaim for volume',
      description: withDocs('Create a Kubernetes PersistentVolumeClaim bound to this Longhorn volume\'s PV.', DOCS.volumes),
      inputSchema: z.object({ name: z.string(), pvcName: z.string().optional(), namespace: z.string().optional() }),
    },
    async ({ name, ...body }, client) => jsonResult(await client.action(RESOURCE, name, 'pvcCreate', body)),
  ),
];
