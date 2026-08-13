# AGENTS.md

Instructions for AI coding agents working in this repository.

## What this is

`longhorn-mcp` is a Model Context Protocol server exposing the [Longhorn](https://longhorn.io) distributed storage manager's REST API. TypeScript, ESM, published to npm and as a Docker image + Helm chart.

## Layout

```
src/
  index.ts          # entry point
  cli.ts             # argv parsing
  server.ts          # MCP server wiring
  longhorn/          # Longhorn API client + types + doc-link helpers
  tools/             # one file per Longhorn resource group (volumes, snapshots, backups, ...)
scripts/
  introspect-schema.ts  # dumps a live Longhorn manager's /v1/schemas
chart/               # Helm chart (published as an OCI artifact on release)
Dockerfile           # multi-stage node:24-slim build
.github/workflows/   # ci.yaml (push/PR), release.yaml (tag push)
```

## Build, test, lint

```bash
npm ci
npm run typecheck   # tsc --noEmit
npm test            # tsx --test 'src/**/*.test.ts'
npm run build        # tsc -p tsconfig.build.json -> dist/
```

Chart changes:

```bash
helm lint chart/
helm template longhorn-mcp chart/
```

Run all of the above before considering a change complete. CI (`ci.yaml`) runs the same checks on every push/PR to `main`.

## Conventions

- Every tool is defined with a Zod schema and a description string that an LLM client actually reads — write these for a model audience, not just a human one. Be specific about parameter shapes and side effects.
- Destructive or hard-to-reverse tools (deletes, force-detaches, reverts, cluster-wide restores, node evictions, engine image changes, backup target redirects, etc.) must have their description suffixed with an explicit instruction not to call the tool unless the user has authorized that specific action in the current conversation — never proactively or as a side effect of an unrelated task. See existing tools in `src/tools/*.ts` for the exact phrasing pattern, and the README's "Destructive-action guardrails" section for the rationale.
- `--read-only` mode must stay a structural guarantee, not just a convention: read-only tool registration happens at server-start filtering (never advertise write tools), and `LonghornClient` independently refuses any non-`GET` request regardless of which tool triggered it. Any new write-capable tool or client method must respect both layers.
- Tool descriptions link to the matching page in Longhorn's official docs (`Longhorn docs: <url>`) pinned to the Longhorn version this server's default `--longhorn-url` target runs — not "latest". Keep new tools consistent with this; a handful of tools with no clear corresponding doc page are the known exceptions (see README).
- No comments explaining *what* code does — only *why*, and only when genuinely non-obvious (a workaround, an invariant, a subtle constraint). Do not restate the code in prose.
- Don't add abstractions, config flags, or generality beyond what's actually needed. Three similar lines beats a premature helper.

## Chart conventions

- Generic, vendor-neutral Helm chart — no Kubernetes distribution or vendor-specific resources baked in. Specifically: **no NetworkPolicy or CiliumNetworkPolicy templates**, and the optional `HTTPRoute` (`route.enabled`) uses only core Gateway API (`gateway.networking.k8s.io/v1`) — no Envoy Gateway (or any other vendor) CRDs/extension policies.
- `values.yaml` changes need a matching `values.schema.json` update and a line in the README's "Deploying with Helm" values table.
- Chart version stays in lockstep with `package.json`'s version and the release tag — don't bump `chart/Chart.yaml`'s `version` independently.

## Release process

Maintainer-only: push a `vX.Y.Z` tag from `main` to trigger `.github/workflows/release.yaml` (Docker image + Helm chart to GHCR, npm publish). Contributors don't need to think about this — see `CONTRIBUTING.md` for details if you do.

## Commit/PR conventions

No project-specific identity or authorship requirements — normal open-source practice applies: your own name/email as author, clear conventional-ish commit messages (`feat(...)`, `fix(...)`, `chore(...)`), one logical change per PR. See `CONTRIBUTING.md`.
