import { getToolShape } from './tool-registry.js';
import { VOLUME_SETTING_ACTION } from './volume-settings.js';

/**
 * Every Longhorn resource instance (a volume, node, backing image, ...)
 * embeds an `actions: { <actionName>: <url> }` map of currently-valid RPC
 * actions, keyed by the resource's own `type` field (e.g. "volume"). Those
 * URLs point at the manager's in-cluster address
 * (http://longhorn-backend[...]:9500/...) — meaningless to an MCP client,
 * which can only call tools, not arbitrary HTTP endpoints. translateActions()
 * (below) rewrites each URL into the MCP tool that performs it instead, so a
 * client reading a resource's `actions` learns what it can call *through
 * this server*, not a URL it has no way to reach.
 *
 * Built from each type's `resourceActions` in GET /v1/schemas/{type},
 * cross-checked against a live 1.12.1 cluster — of every resource type this
 * server exposes, only these six ever declare custom actions; everything
 * else is plain CRUD (list/get/create/update/delete), which needs no
 * translation since there's no `actions` map to rewrite.
 */
const ACTION_TOOL_MAP: Record<string, Record<string, string>> = {
  volume: {
    activate: 'volume_activate',
    attach: 'volume_attach',
    cancelExpansion: 'volume_cancel_expansion',
    detach: 'volume_detach',
    engineUpgrade: 'volume_engine_upgrade',
    expand: 'volume_expand',
    jobList: 'volume_job_list',
    pvCreate: 'volume_pv_create',
    pvcCreate: 'volume_pvc_create',
    recurringJobAdd: 'volume_recurring_job_add',
    recurringJobDelete: 'volume_recurring_job_delete',
    recurringJobList: 'volume_recurring_job_list',
    replicaRemove: 'volume_replica_remove',
    salvage: 'volume_salvage',
    snapshotBackup: 'volume_snapshot_backup',
    snapshotCRCreate: 'volume_snapshot_cr_create',
    snapshotCRDelete: 'volume_snapshot_cr_delete',
    snapshotCRGet: 'volume_snapshot_cr_get',
    snapshotCRList: 'volume_snapshot_cr_list',
    snapshotCreate: 'volume_snapshot_create',
    snapshotDelete: 'volume_snapshot_delete',
    snapshotGet: 'volume_snapshot_get',
    snapshotList: 'volume_snapshot_list',
    snapshotPurge: 'volume_snapshot_purge',
    snapshotRevert: 'volume_snapshot_revert',
    trimFilesystem: 'volume_trim_filesystem',
    offlineReplicaRebuilding: 'volume_update_setting',
    // The updateXxx entries below are filled in from VOLUME_SETTING_ACTION,
    // inverted, right after this object literal — see volume-settings.ts.
  },
  node: {
    diskUpdate: 'node_disk_update',
  },
  backingImage: {
    backingImageCleanup: 'backingimage_cleanup',
    backupBackingImageCreate: 'backingimage_backup_create',
    updateMinNumberOfCopies: 'backingimage_update_min_copies',
    upload: 'backingimage_upload',
  },
  backupBackingImage: {
    backupBackingImageRestore: 'backupbackingimage_restore',
  },
  backupTarget: {
    backupTargetSync: 'backuptarget_sync',
    backupTargetUpdate: 'backuptarget_update_name',
  },
  backupVolume: {
    backupDelete: 'backupvolume_backup_delete',
    backupGet: 'backupvolume_backup_get',
    backupList: 'backupvolume_backup_list',
    backupListByVolume: 'backupvolume_backup_list_by_volume',
    backupVolumeSync: 'backupvolume_sync',
  },
};

/** volume_update_setting's `setting` argument for each updateXxx action name it covers, e.g. { updateAccessMode: "accessMode" }. */
const VOLUME_SETTING_FOR_ACTION: Record<string, string> = Object.fromEntries(
  Object.entries(VOLUME_SETTING_ACTION).map(([setting, action]) => [action, setting]),
);
for (const action of Object.keys(VOLUME_SETTING_FOR_ACTION)) {
  ACTION_TOOL_MAP.volume[action] = 'volume_update_setting';
}

type ActionLink = { tool: string; shape?: Record<string, string>; args?: Record<string, string> };

/**
 * Builds the translated link for `tool`: its full parameter shape (from
 * tool-registry.ts, populated by defineTool()) plus, when this action
 * already pins one or more of those parameters down (e.g. `args.setting` on
 * volume_update_setting), an `args` object naming the value to use. `shape`
 * always lists every parameter the tool takes, pinned ones included — a
 * partial shape that silently omitted them would leave a reader unable to
 * tell whether `args.setting` refers to a real parameter without a separate
 * lookup.
 */
function buildLink(tool: string, args?: Record<string, string>): ActionLink {
  const shape = getToolShape(tool);
  return {
    tool,
    ...(shape && Object.keys(shape).length > 0 ? { shape } : {}),
    ...(args ? { args } : {}),
  };
}

function translateAction(type: string, action: string, url: unknown): ActionLink | unknown {
  if (typeof url !== 'string') return url;

  const tool = ACTION_TOOL_MAP[type]?.[action];
  if (tool === 'volume_update_setting') {
    return buildLink(tool, { setting: VOLUME_SETTING_FOR_ACTION[action] });
  }
  if (tool) return buildLink(tool);

  // No named tool covers this action — fall back to the raw path so
  // longhorn_raw_request can still reach it. Every action every resource
  // type's schema currently declares is mapped above, so this is a safety
  // net for a future Longhorn version adding one this server hasn't caught
  // up to yet, not a normal case.
  let path = url;
  try {
    path = new URL(url).pathname + new URL(url).search;
  } catch {
    // Not a parseable absolute URL — pass it through unchanged.
  }
  return buildLink('longhorn_raw_request', { method: 'POST', path });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively rewrites every `actions: {...}` map found on a norman-style
 * resource object (identified by a sibling `type` field) from action-name ->
 * URL into action-name -> the MCP tool that performs it. Applied in
 * jsonResult() so every tool's response gets this treatment automatically.
 */
export function translateActions(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(translateActions);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const type = typeof value.type === 'string' ? value.type : undefined;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === 'actions' && type && isPlainObject(val)) {
      result[key] = Object.fromEntries(Object.entries(val).map(([action, url]) => [action, translateAction(type, action, url)]));
    } else {
      result[key] = translateActions(val);
    }
  }
  return result;
}
