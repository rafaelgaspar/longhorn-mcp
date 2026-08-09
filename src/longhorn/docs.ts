/**
 * Longhorn documentation links surfaced in tool descriptions. Pinned to
 * 1.12.0 (the version this cluster runs — see namespaces/longhorn-system/
 * longhorn-helmrelease.yaml) rather than "latest", so the linked content
 * matches the API this server actually talks to. Bump alongside that chart
 * version; each URL was verified to resolve to real, on-topic Longhorn docs
 * as of 2026-08.
 */
const BASE = 'https://longhorn.io/docs/1.12.0';

export const DOCS = {
  volumes: `${BASE}/nodes-and-volumes/volumes/create-volumes/`,
  nodes: `${BASE}/nodes-and-volumes/nodes/`,
  snapshots: `${BASE}/snapshots-and-backups/setup-a-snapshot/`,
  backupAndRestore: `${BASE}/snapshots-and-backups/backup-and-restore/`,
  disasterRecovery: `${BASE}/snapshots-and-backups/setup-disaster-recovery-volumes/`,
  recurringJobs: `${BASE}/snapshots-and-backups/scheduling-backups-and-snapshots/`,
  backingImage: `${BASE}/advanced-resources/backing-image/`,
  systemBackupRestore: `${BASE}/advanced-resources/system-backup-restore/`,
  orphanedDataCleanup: `${BASE}/advanced-resources/data-cleanup/orphaned-data-cleanup/`,
  settings: `${BASE}/references/settings/`,
  upgrade: `${BASE}/deploy/upgrade/`,
  supportBundle: `${BASE}/troubleshoot/support-bundle/`,
} as const;
