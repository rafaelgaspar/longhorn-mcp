import { McpServer } from '@modelcontextprotocol/server';
import { LonghornClient } from './longhorn/client.js';
import { registerAllTools } from './tools/index.js';

export const SERVER_VERSION = '0.1.0';

/**
 * Surfaced by MCP clients that support it as general operating guidance, in
 * addition to (not instead of) each tool's own description — so the
 * destructive-action section here is deliberately redundant with
 * tools/tool-def.ts's destructive(). Definitions below are taken from
 * Longhorn's own docs/terminology, not paraphrased loosely, so they stay
 * accurate as a quick reference without a docs round-trip for common terms.
 */
export const SERVER_INSTRUCTIONS = `This server exposes the Longhorn distributed storage manager's REST API (self-described at runtime via GET /v1/schemas — see longhorn_list_resource_types / longhorn_describe_resource_type) as MCP tools. Longhorn is the storage layer backing live Kubernetes workloads in this cluster: every volume it manages is real, currently-mounted, production data, not a sandbox.

## Tool naming and coverage

Tools are named "<resource>_<action>", e.g. volume_list, volume_snapshot_create, backupvolume_backup_delete, node_disk_update. Resources map directly to Longhorn's own concepts (below). Most resources follow a consistent CRUD shape: "<resource>_list" / "<resource>_get" for reads, "<resource>_create" / "<resource>_update" / "<resource>_delete" for writes, plus resource-specific actions (e.g. volume_attach, volume_snapshot_revert). If a specific field or action isn't covered by a named tool, use longhorn_describe_resource_type to see the resource's real current schema, then longhorn_raw_request as a fallback rather than guessing a shape — Longhorn's schema is self-describing and can be checked directly instead of assumed.

## Core concepts (Longhorn's own terminology)

- **Volume** — a storage unit consisting of a dedicated Engine and multiple Replicas; Longhorn synchronously replicates it across multiple nodes.
- **Engine** — the storage controller for one volume, always running on the same node as the pod using that volume.
- **Replica** — one copy of a volume's data, stored on a node as a chain of snapshots; volumes stay available as long as enough replicas survive.
- **Node** — a Kubernetes cluster machine running Longhorn components (manager, engines, replicas).
- **Disk** — a storage device on a node that Longhorn schedules replicas onto.
- **Snapshot** — a point-in-time, in-cluster capture of a volume's data; snapshots chain, with the oldest as the base layer.
- **Backup** — a snapshot's data copied to external object storage (the "backupstore": NFS or S3-compatible), i.e. it survives losing the whole cluster, unlike a snapshot.
- **Backup Target** — the configured external backupstore location backups are written to and restored from.
- **Backing Image** — a QCOW2/RAW image used as the base layer for a volume (e.g. importing a VM disk); every snapshot in that volume's chain builds on it.
- **Engine Image** — one released version of the Longhorn engine binary; different volumes can run different engine image versions simultaneously during a rolling upgrade.
- **Instance Manager** — the per-node process manager that actually launches engine and replica processes for that node's engine image version.
- **Recurring Job** — a scheduled (cron) snapshot/backup/trim/cleanup task, attached to one or more volumes directly or via a group.
- **DR (standby) volume** — a volume created from a backup that stays in passive, continuously-syncing standby state until activated (volume_activate) during failover.
- **System Backup / System Restore** — a bundle of Longhorn's own custom resources (not volume data) backed up as a unit, for restoring the whole Longhorn deployment onto a new or existing cluster.
- **Orphan** — a replica or engine instance directory Longhorn has detected on disk with no corresponding live resource (see orphan_list); read-only in this API.
- **Support Bundle** — a downloadable archive of cluster manifests and logs for troubleshooting/sharing with Longhorn maintainers.

## Common tasks

- **Survey cluster storage health**: node_list (scheduling/disk state), volume_list (robustness/state per volume), longhorn_events, orphan_list.
- **Create and attach a volume**: volume_create, then volume_attach (or volume_pv_create + volume_pvc_create to hand it to Kubernetes as a PV/PVC instead of attaching directly).
- **Protect a volume's data**: volume_snapshot_create for a local point-in-time copy; volume_snapshot_backup (or snapshotting then backing up) to also push it to the configured backup target — a backup target must exist first (backuptarget_create/backuptarget_list).
- **Automate protection**: recurringjob_create to define the schedule, then volume_recurring_job_add to attach it to specific volumes (or a group).
- **Restore a volume from a backup**: volume_create with fromBackup set to the backup's URL (from backup_list/backup_get).
- **Set up disaster recovery**: create a DR volume from a backup (frontend omitted so it stays a standby), monitor it, and only call volume_activate to fail over when the user has explicitly asked for that.
- **Investigate a degraded/stuck volume**: volume_get (state/robustness/currentNodeID), volume_snapshot_list / snapshot_list, node_get for the nodes it's scheduled on, engineimage_list and instancemanager_list for the engine's health.
- **Whole-cluster DR**: systembackup_create to capture Longhorn's own state; systemrestore_create to restore it — this is one of the most destructive tools in this server (see below) and restores cluster-wide state, not a single volume.

## Destructive actions

Many tools are destructive or hard to reverse — deleting volumes, snapshots, or backups; reverting or restoring data; force-detaching a volume; evicting a node; deploying a new engine image — and their descriptions are marked "Destructive" accordingly. Do not call a destructive tool unless the user has explicitly authorized that specific action in this conversation. Never call one proactively, speculatively, to "clean up," or as a side effect of an unrelated task — if it is unclear whether an action is destructive or whether the user has authorized it, ask first instead of guessing.`;

export interface ServerOptions {
  longhornUrl: string;
  readOnly: boolean;
}

export function createServer(options: ServerOptions): McpServer {
  const server = new McpServer(
    {
      name: options.readOnly ? 'longhorn-readonly-mcp' : 'longhorn-mcp',
      version: SERVER_VERSION,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );
  const client = new LonghornClient({ baseUrl: options.longhornUrl, readOnly: options.readOnly });
  registerAllTools(server, client, { readOnly: options.readOnly });
  return server;
}
