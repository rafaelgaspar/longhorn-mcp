import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod/v4';
import type { LonghornClient } from '../longhorn/client.js';
import { translateActions } from './action-links.js';
import { defineToolShape } from './tool-registry.js';

/**
 * `write: true` tools are skipped at registration time when the server runs
 * with --read-only (see tools/index.ts). LonghornClient.request() also
 * refuses any non-GET call when read-only, as defense-in-depth for
 * longhorn_raw_request (whose write-ness isn't known until call time).
 */
export interface ToolDef {
  name: string;
  write: boolean;
  register(server: McpServer, client: LonghornClient): void;
}

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

export function jsonResult(data: unknown): ToolResult {
  // JSON.stringify(undefined) returns the *value* undefined, not a string —
  // TypeScript's lib.d.ts types JSON.stringify as always returning `string`,
  // which is inaccurate for undefined/functions/symbols, so tsc won't catch
  // this. Longhorn's DELETE responses in particular can have an empty body,
  // which LonghornClient.request() surfaces as `undefined`.
  if (data === undefined) return textResult('(empty response body)');
  return textResult(JSON.stringify(translateActions(data), null, 2));
}

export function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: message }], isError: true };
}

interface ToolMeta<Shape extends z.ZodRawShape> {
  title: string;
  description: string;
  inputSchema: z.ZodObject<Shape>;
}

/**
 * Standard warning appended to every tool description whose action is
 * destructive or hard to reverse (deletes, force-detaches, reverts,
 * restores cluster-wide state, evicts a node, deploys an arbitrary engine
 * image, etc.) — see SERVER_INSTRUCTIONS in server.ts for the server-wide
 * version of the same guidance.
 */
export function destructive(description: string): string {
  return `${description} Destructive. Do not call this unless the user has explicitly authorized it in this conversation — never proactively, speculatively, or as a side effect of another task.`;
}

/** Appends a Longhorn documentation link to a tool description. */
export function withDocs(description: string, url: string): string {
  return `${description} Longhorn docs: ${url}`;
}

/**
 * Wraps a handler with standard error → isError-result translation so
 * individual tool modules don't repeat try/catch boilerplate around every
 * LonghornApiError/LonghornReadOnlyError.
 */
export function defineTool<Shape extends z.ZodRawShape>(
  name: string,
  write: boolean,
  meta: ToolMeta<Shape>,
  handler: (args: z.infer<z.ZodObject<Shape>>, client: LonghornClient) => Promise<ToolResult>,
): ToolDef {
  defineToolShape(name, meta.inputSchema);
  return {
    name,
    write,
    register(server, client) {
      // The SDK's registerTool callback return type is a large union
      // (CallToolResult | InputRequiredResult | ...) that our intentionally
      // small ToolResult shape structurally satisfies at runtime but that
      // TypeScript can't always prove element-wise against every branch.
      // Cast at this single adapter boundary rather than widening ToolResult
      // everywhere it's used.
      const wrapped = async (args: z.infer<z.ZodObject<Shape>>): Promise<ToolResult> => {
        try {
          return await handler(args, client);
        } catch (error) {
          return errorResult(error);
        }
      };
      server.registerTool(name, meta, wrapped as unknown as Parameters<typeof server.registerTool>[2]);
    },
  };
}
