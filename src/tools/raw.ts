import * as z from 'zod/v4';
import { defineTool, jsonResult, type ToolDef } from './tool-def.js';

export const tools: ToolDef[] = [
  defineTool(
    'longhorn_list_resource_types',
    false,
    {
      title: 'List Longhorn resource types',
      description: "List every resource type Longhorn's manager API exposes, self-described at runtime via GET /v1/schemas.",
      inputSchema: z.object({}),
    },
    async (_args, client) => jsonResult(await client.schemas()),
  ),

  defineTool(
    'longhorn_describe_resource_type',
    false,
    {
      title: 'Describe a Longhorn resource type',
      description: 'Describe one resource type\'s fields and available actions via GET /v1/schemas/{id} (e.g. "volume", "backupTarget", "node").',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, client) => jsonResult(await client.schema(id)),
  ),

  // write: false so this stays registered even in --read-only mode — the
  // client-layer guard (LonghornClient.request()) is what actually enforces
  // read-only here, since the tool's method isn't known until call time.
  defineTool(
    'longhorn_raw_request',
    false,
    {
      title: 'Raw Longhorn API request',
      description:
        'Escape hatch for any Longhorn API endpoint not covered by a named tool. In --read-only mode, only GET requests succeed — everything else is refused before it reaches Longhorn. GET is always safe to call freely; for POST/PUT/DELETE, treat this exactly like the destructive tools elsewhere in this server — do not call with a mutating method unless the user has explicitly authorized that specific action in this conversation.',
      inputSchema: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        // A plain startsWith('/v1/') check is bypassable — "/v1/../metrics"
        // passes it but resolves to "/metrics" once client.request() hands
        // it to fetch(), which normalizes dot-segments per the URL spec.
        // Normalize via the URL parser *before* checking (and use the
        // normalized value downstream), so validation and the actual
        // request always agree.
        path: z
          .string()
          .transform((p, ctx) => {
            const normalized = new URL(p, 'http://longhorn-mcp.invalid').pathname;
            if (!normalized.startsWith('/v1/')) {
              ctx.addIssue({ code: 'custom', message: 'path must resolve to /v1/*' });
              return z.NEVER;
            }
            return normalized;
          })
          .describe('Path starting with /v1/, e.g. "/v1/volumes/my-volume".'),
        body: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    async ({ method, path, body }, client) => jsonResult(await client.request(method, path, body)),
  ),
];
