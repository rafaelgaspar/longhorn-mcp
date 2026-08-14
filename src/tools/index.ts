import type { McpServer } from '@modelcontextprotocol/server';
import type { LonghornClient } from '../longhorn/client.js';
import { tools as backingImageTools } from './backing-images.js';
import { tools as backupTools } from './backups.js';
import { tools as engineTools } from './engines.js';
import { tools as nodeTools } from './nodes.js';
import { tools as rawTools } from './raw.js';
import { tools as recurringJobTools } from './recurring-jobs.js';
import { tools as settingTools } from './settings.js';
import { tools as shardTools } from './shards.js';
import { tools as snapshotTools } from './snapshots.js';
import { tools as systemTools } from './system.js';
import type { ToolDef } from './tool-def.js';
import { tools as volumeTools } from './volumes.js';

const ALL_TOOLS: ToolDef[] = [
  ...volumeTools,
  ...snapshotTools,
  ...backupTools,
  ...backingImageTools,
  ...nodeTools,
  ...settingTools,
  ...engineTools,
  ...recurringJobTools,
  ...systemTools,
  ...shardTools,
  ...rawTools,
];

export interface RegisterOptions {
  readOnly: boolean;
}

/**
 * Registers every tool, skipping `write: true` tools when readOnly is set.
 * This is the primary --read-only enforcement layer: a read-only server's
 * tools/list never advertises a write tool in the first place. The
 * LonghornClient's own method-based guard (see longhorn/client.ts) is
 * defense-in-depth for the one tool whose write-ness isn't known until call
 * time — longhorn_raw_request.
 */
export function registerAllTools(server: McpServer, client: LonghornClient, options: RegisterOptions): void {
  for (const tool of ALL_TOOLS) {
    if (options.readOnly && tool.write) continue;
    tool.register(server, client);
  }
}

export { ALL_TOOLS };
