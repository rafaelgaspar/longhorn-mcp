# longhorn-mcp

An MCP server for the [Longhorn](https://longhorn.io) distributed storage manager API. Full read/write coverage of Longhorn's REST API (volumes, snapshots, backups, backing images, nodes, settings, engine images, recurring jobs, and more), a `--read-only` mode, both stdio and Streamable HTTP transports, and an official Helm chart.

> **AI-assisted development.** The majority of this codebase — implementation, tests, and this documentation — was written with AI assistance (Claude). Review accordingly, especially before running write-mode tools against a production Longhorn cluster.

## Quick start

```bash
npx -y longhorn-mcp --longhorn-url=http://<longhorn-manager-host>:9500
```

Longhorn's manager API is **unauthenticated** — reachability is the only access control. If you're not running this against an in-cluster Longhorn (see [Connecting popular MCP clients](#connecting-popular-mcp-clients) → Remote/HTTP), you'll need a VPN, SSH tunnel, or `kubectl port-forward svc/longhorn-backend 9500:9500` to reach it safely. Never expose Longhorn's manager API directly to an untrusted network.

## CLI reference

| Flag | Default | Description |
|---|---|---|
| `--http` | off (stdio) | Serve Streamable HTTP instead of stdio. |
| `--port` | `3000` | HTTP listen port (with `--http`). |
| `--host` | `0.0.0.0` | HTTP listen address (with `--http`). |
| `--read-only` | off | Register only read tools; the client also refuses any non-GET request. |
| `--longhorn-url` | `http://longhorn-backend.longhorn-system.svc.cluster.local:9500` | Base URL of the Longhorn manager API. Standard Kubernetes cluster-local DNS by default — a cluster with a custom cluster domain overrides this via `--longhorn-url` in its own Deployment rather than changing this package's default. |
| `--allowed-hosts` | `localhost,127.0.0.1` | Comma-separated `Host`/`Origin` allowlist for `--http` mode. Must include every hostname/IP:port the server will actually be reached on — see [MCP spec DNS rebinding guidance](https://modelcontextprotocol.io/specification). |

## Deploying with Helm

An official chart is published alongside every release:

```bash
helm install longhorn-mcp oci://ghcr.io/rafaelgaspar/longhorn-mcp/charts/longhorn-mcp --version 0.1.0 \
  --set args[0]=--http \
  --set args[1]=--longhorn-url=http://longhorn-backend.longhorn-system.svc.cluster.local:9500
```

Key values:

| Value | Default | Notes |
|---|---|---|
| `image.repository` / `image.tag` | `ghcr.io/rafaelgaspar/longhorn-mcp` / chart `appVersion` | |
| `args` | `["--http"]` | Append `--read-only`, `--longhorn-url`, `--allowed-hosts`, etc. — see [CLI reference](#cli-reference). |
| `service.enabled` / `.type` / `.port` | `true` / `ClusterIP` / `3000` | |
| `route.enabled` | `false` | Optional, vendor-neutral core Gateway API `HTTPRoute` (`gateway.networking.k8s.io/v1`) — no Envoy Gateway-specific resources. Bring your own `Gateway` and set `route.parentRefs`/`route.hostnames`. |
| `serviceAccount.create` | `true` | |

Full schema: [`chart/values.yaml`](./chart/values.yaml) / [`chart/values.schema.json`](./chart/values.schema.json).

The chart is also attached as an OCI referrer directly on the image manifest, for tooling that discovers charts via the [OCI Referrers API](https://oras.land/docs/how_to_guides/artifact_referrers/) instead of pulling a separately tagged artifact:

```bash
oras discover ghcr.io/rafaelgaspar/longhorn-mcp:0.1.0
```

## Connecting popular MCP clients

Each client's exact config file path/key can drift between versions — check the client's own docs if these don't work. All of them accept the same underlying `command`/`args` shape for a local stdio server.

### Claude Code

```bash
claude mcp add longhorn -- npx -y longhorn-mcp --longhorn-url=http://localhost:9500
```

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "longhorn": {
      "command": "npx",
      "args": ["-y", "longhorn-mcp", "--longhorn-url=http://localhost:9500"]
    }
  }
}
```

### Cursor

Edit `.cursor/mcp.json` (project-scoped) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "longhorn": {
      "command": "npx",
      "args": ["-y", "longhorn-mcp", "--longhorn-url=http://localhost:9500"]
    }
  }
}
```

### VS Code (Copilot Chat)

`.vscode/mcp.json` uses a `servers` key (not `mcpServers`):

```json
{
  "servers": {
    "longhorn": {
      "command": "npx",
      "args": ["-y", "longhorn-mcp", "--longhorn-url=http://localhost:9500"]
    }
  }
}
```

### Remote/HTTP

To point a client at an already-running Streamable HTTP instance (e.g. this server deployed in-cluster, see [Deploying with Helm](#deploying-with-helm)) instead of spawning a local `npx` process, use that client's remote-MCP configuration with the server's `/mcp` URL. Clients without native remote-HTTP MCP support can bridge via [`mcp-remote`](https://www.npmjs.com/package/mcp-remote).

### Running behind a gateway

Longhorn's manager API — and by extension this server — has no authentication of its own; reachability is the access control (see [Quick start](#quick-start)). For a multi-tenant or externally-reachable deployment, fronting `--http` mode with an MCP-aware gateway (e.g. [Envoy AI Gateway](https://aigateway.envoyproxy.io/) or similar) for auth, rate limiting, and routing is a good idea. It's not required, though — a private network boundary (VPN, SSH tunnel, cluster-internal only) is a perfectly reasonable standalone posture too, and is exactly what the Helm chart defaults to (`route.enabled: false`, no external exposure).

## Destructive-action guardrails

`--read-only` is an enforced, structural guarantee (see below); the following is a softer, model-facing one — it shapes what a well-behaved LLM *should* do, not what the server *can* refuse.

Every tool whose action is destructive or hard to reverse (deletes, force-detaches, reverts, restores cluster-wide state, evicts a node, deploys an arbitrary engine image, redirects a backup target, etc.) has its description suffixed with an explicit instruction not to call it unless the user has explicitly authorized that specific action in the current conversation, and never proactively, speculatively, or as a side effect of an unrelated task. The server's MCP `instructions` field (surfaced by clients that support it, in addition to each tool's own description) repeats the same guidance at the server level as a backstop for tools called without reading their full description closely.

This is advisory, not enforced — a client or model can ignore it. It reduces the chance of an LLM calling `volume_delete` or `systemrestore_create` as an unprompted "helpful" side effect; it is not a substitute for `--read-only` where that's the guarantee you actually need.

## Longhorn documentation links

Most tool descriptions end with a `Longhorn docs: <url>` link to the relevant page in [Longhorn's official documentation](https://longhorn.io/docs/), pinned to the Longhorn version this server's default `--longhorn-url` target runs (currently 1.12.1) rather than "latest," so the linked content matches the API version actually in use. A handful of tools with no clearly corresponding doc page (`instancemanager_*`, `volumeattachment_*`, `longhorn_events`, the `longhorn_raw_request`/`longhorn_list_resource_types`/`longhorn_describe_resource_type` introspection tools) don't have one.

## Read-only mode

`--read-only` enforces itself two ways:

1. **Registration-time filtering** — every write tool is simply never advertised in `tools/list`, so a read-only instance's tool set is a strict subset of the read-write one.
2. **Client-layer guard** — `LonghornClient` refuses any non-`GET` request regardless of which tool triggered it. This is what protects `longhorn_raw_request`, the one escape-hatch tool that stays registered in both modes (its write-ness isn't known until it's actually called).

Run both a read-write and a read-only instance under different names in the same client config if you want an LLM session to default to read-only but have an explicit, differently-named write-capable tool set available:

```json
{
  "mcpServers": {
    "longhorn": { "command": "npx", "args": ["-y", "longhorn-mcp", "--longhorn-url=http://localhost:9500"] },
    "longhorn-readonly": { "command": "npx", "args": ["-y", "longhorn-mcp", "--read-only", "--longhorn-url=http://localhost:9500"] }
  }
}
```

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`scripts/introspect-schema.ts` dumps a live Longhorn manager's self-described `/v1/schemas` — useful for cross-checking this package's hand-written tool coverage against whatever Longhorn version you're actually running:

```bash
npm run introspect-schema -- http://localhost:9500
npm run introspect-schema -- http://localhost:9500 volume   # one resource type in full
```

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup, coding conventions, and how releases work.

## License

MIT — see [LICENSE](./LICENSE).
