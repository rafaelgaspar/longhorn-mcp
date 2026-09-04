/**
 * Longhorn's ~19 single-field `update*`/`offlineReplicaRebuilding` volume
 * actions all share the same POST-action/single-field shape (verified against
 * the live cluster's /v1/schemas — see e.g. UpdateReplicaCountInput,
 * UpdateDataLocalityInput, UpdateOfflineRebuildingInput). Consolidated in
 * volume_update_setting (volumes.ts) into one parameterized tool instead of
 * ~19 near-identical ones. Lives in its own module (rather than inline in
 * volumes.ts) so action-links.ts can import it too, to translate each
 * `updateXxx` action name back into a volume_update_setting call, without
 * volumes.ts and tool-def.ts ending up in an import cycle.
 */
export const VOLUME_SETTINGS: Record<string, string> = {
  replicaCount: 'replicaCount',
  replicaAutoBalance: 'replicaAutoBalance',
  rebuildConcurrentSyncLimit: 'rebuildConcurrentSyncLimit',
  dataLocality: 'dataLocality',
  accessMode: 'accessMode',
  snapshotDataIntegrity: 'snapshotDataIntegrity',
  snapshotMaxCount: 'snapshotMaxCount',
  snapshotMaxSize: 'snapshotMaxSize',
  replicaRebuildingBandwidthLimit: 'replicaRebuildingBandwidthLimit',
  ublkQueueDepth: 'ublkQueueDepth',
  ublkNumberOfQueue: 'ublkNumberOfQueue',
  backupCompressionMethod: 'backupCompressionMethod',
  unmapMarkSnapChainRemoved: 'unmapMarkSnapChainRemoved',
  replicaSoftAntiAffinity: 'replicaSoftAntiAffinity',
  replicaZoneSoftAntiAffinity: 'replicaZoneSoftAntiAffinity',
  replicaDiskSoftAntiAffinity: 'replicaDiskSoftAntiAffinity',
  freezeFilesystemForSnapshot: 'freezeFilesystemForSnapshot',
  backupTargetName: 'backupTargetName',
  offlineReplicaRebuilding: 'offlineRebuilding',
};

export const VOLUME_SETTING_ACTION: Record<string, string> = {
  replicaCount: 'updateReplicaCount',
  replicaAutoBalance: 'updateReplicaAutoBalance',
  rebuildConcurrentSyncLimit: 'updateRebuildConcurrentSyncLimit',
  dataLocality: 'updateDataLocality',
  accessMode: 'updateAccessMode',
  snapshotDataIntegrity: 'updateSnapshotDataIntegrity',
  snapshotMaxCount: 'updateSnapshotMaxCount',
  snapshotMaxSize: 'updateSnapshotMaxSize',
  replicaRebuildingBandwidthLimit: 'updateReplicaRebuildingBandwidthLimit',
  ublkQueueDepth: 'updateUblkQueueDepth',
  ublkNumberOfQueue: 'updateUblkNumberOfQueue',
  backupCompressionMethod: 'updateBackupCompressionMethod',
  unmapMarkSnapChainRemoved: 'updateUnmapMarkSnapChainRemoved',
  replicaSoftAntiAffinity: 'updateReplicaSoftAntiAffinity',
  replicaZoneSoftAntiAffinity: 'updateReplicaZoneSoftAntiAffinity',
  replicaDiskSoftAntiAffinity: 'updateReplicaDiskSoftAntiAffinity',
  freezeFilesystemForSnapshot: 'updateFreezeFilesystemForSnapshot',
  backupTargetName: 'updateBackupTargetName',
  offlineReplicaRebuilding: 'offlineReplicaRebuilding',
};
