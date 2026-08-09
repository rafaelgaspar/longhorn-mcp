/**
 * Longhorn's manager API is self-describing at runtime (`GET /v1/schemas`,
 * `GET /v1/schemas/{id}` — see `longhorn_list_resource_types` /
 * `longhorn_describe_resource_type`, and scripts/introspect-schema.ts for a
 * dev-time dump), so tool responses are passed through as `unknown` JSON
 * rather than hand-typed here. This file only types the schema-introspection
 * shape itself, which scripts/introspect-schema.ts actually consumes.
 */

export interface SchemaCollectionAction {
  input?: string;
  output?: string;
}

export interface LonghornSchema {
  id: string;
  pluralName?: string;
  resourceMethods?: string[];
  collectionMethods?: string[];
  resourceActions?: Record<string, SchemaCollectionAction>;
  collectionActions?: Record<string, SchemaCollectionAction>;
  resourceFields?: Record<string, { type: string; required?: boolean; default?: unknown }>;
  [key: string]: unknown;
}
