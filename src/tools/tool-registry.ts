import * as z from 'zod/v4';

const MAX_INLINE_ENUM_VALUES = 6;

function typeLabel(prop: Record<string, unknown>): string {
  if (Array.isArray(prop.enum)) {
    const values = prop.enum as unknown[];
    return values.length <= MAX_INLINE_ENUM_VALUES ? `enum(${values.join('|')})` : `enum(${values.length} values)`;
  }
  if (Array.isArray(prop.anyOf)) {
    return (prop.anyOf as Record<string, unknown>[]).map(typeLabel).join('|');
  }
  if (prop.type === 'array') {
    return `${typeLabel((prop.items ?? {}) as Record<string, unknown>)}[]`;
  }
  if (prop.type === 'object') return 'object';
  return typeof prop.type === 'string' ? prop.type : 'unknown';
}

/**
 * Tiny registry, keyed by tool name, of each tool's parameters compacted
 * into { paramName: "type" } (optional params suffixed "?") — e.g.
 * { name: "string", hostId: "string", disableFrontend: "boolean?" }.
 * Populated by defineTool() (tool-def.ts) as each tools/*.ts module's
 * top-level `tools` array is built, i.e. as soon as it's imported — well
 * before the server handles its first request, regardless of import order.
 *
 * Lives in its own zero-dependency module, rather than inside tool-def.ts or
 * action-links.ts directly, because action-links.ts (used by every tool via
 * jsonResult()) needs to read tool shapes by name without importing
 * tools/index.ts — which imports every tools/*.ts file, which imports
 * tool-def.ts, which would cycle straight back.
 */
const shapes = new Map<string, Record<string, string>>();

export function defineToolShape(name: string, inputSchema: z.ZodTypeAny): void {
  // io: 'input' — longhorn_raw_request's `path` field is a z.string().transform(...);
  // toJSONSchema() throws on transforms by default since it converts the
  // *output* schema (unrepresentable for an arbitrary transform function).
  // 'input' converts the pre-transform schema instead, which is exactly the
  // shape a caller needs to know to supply. unrepresentable: 'any' is a
  // safety net for any other construct JSON Schema can't express.
  const json = z.toJSONSchema(inputSchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  const properties = (json.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set((json.required ?? []) as string[]);
  const shape: Record<string, string> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const label = typeLabel(prop);
    shape[key] = required.has(key) ? label : `${label}?`;
  }
  shapes.set(name, shape);
}

export function getToolShape(name: string): Record<string, string> | undefined {
  return shapes.get(name);
}
