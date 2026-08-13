# Contributing

Thanks for considering a contribution to `longhorn-mcp`.

## Dev setup

```bash
git clone https://github.com/rafaelgaspar/longhorn-mcp
cd longhorn-mcp
npm ci
npm run typecheck
npm test
npm run build
```

`node dist/index.js --longhorn-url=http://<longhorn-manager-host>:9500` runs your local build directly, without publishing anything.

If you're touching `chart/`, also run:

```bash
helm lint chart/
helm template longhorn-mcp chart/
```

## Code style

- TypeScript, ESM (`type: module`). Keep new code consistent with the existing style in `src/` rather than introducing a new pattern.
- Every tool's Zod schema and description matters — this is what an LLM client sees. Prefer clear, specific descriptions over terse ones.
- Destructive/hard-to-reverse tools should follow the existing convention of an explicit "don't call this unless the user has authorized it" instruction in the description (see `src/tools/*.ts` for examples) — see the README's [Destructive-action guardrails](./README.md#destructive-action-guardrails) section.
- No comments explaining *what* code does; only *why*, when it's genuinely non-obvious.

## Workflow

1. Fork the repo and branch off `main`.
2. Keep PRs scoped to one logical change — avoid bundling unrelated fixes/features.
3. Make sure `npm run typecheck`, `npm test`, and (if applicable) `helm lint chart/` all pass locally before opening the PR. CI runs the same checks and must be green before merge.
4. Write commit messages and PR titles in the imperative, conventional-commit-ish style already used in the history (`feat(...)`, `fix(...)`, `chore(...)`, etc.) — not required, but appreciated.
5. Update the README/CONTRIBUTING/chart values docs alongside any user-facing change (new flag, new tool, new chart value).

## Releasing (maintainers)

Releases are cut by pushing a `vX.Y.Z` tag from `main` (matching `package.json`'s `version` and `Chart.yaml`'s `version`). That triggers `.github/workflows/release.yaml`, which independently:

- Builds and pushes the multi-arch Docker image to `ghcr.io/rafaelgaspar/longhorn-mcp`.
- Packages the Helm chart, attaches it to the image manifest (`oras attach`), and pushes it as a standalone tagged artifact to `oci://ghcr.io/rafaelgaspar/longhorn-mcp/charts`.
- Publishes to npm (`npm publish --access public`).

Contributors don't need to do any of this — only a maintainer pushing a release tag triggers it.

### npm publishing auth

The `npm` job currently authenticates with a classic `NPM_TOKEN` repo secret, because npm's [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC, no stored token) can only be configured on a package that already exists on the registry — a brand-new package name needs one manual/token-based publish first. Once the package exists, switch to Trusted Publishing (npmjs.com → package settings → Trusted Publisher: org `rafaelgaspar`, repo `longhorn-mcp`, workflow filename `release.yaml`), update the `npm` job to use `permissions: id-token: write` with no token, and delete the `NPM_TOKEN` secret.

## Dependency updates

[Renovate](https://docs.renovatebot.com/) is configured via `renovate.json` (npm dependencies, Dockerfile pins, GitHub Actions pins — grouped by non-major/major, no release-age delay, non-majors automerge as soon as CI passes). It runs self-hosted via `.github/workflows/renovate.yaml` (weekday cron + manual dispatch) using [`renovatebot/github-action`](https://github.com/renovatebot/github-action), authenticating as a GitHub App rather than the hosted [Renovate GitHub App](https://github.com/apps/renovate). The workflow mints a short-lived installation token via [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token) from the `RENOVATE_APP_CLIENT_ID` and `RENOVATE_APP_PRIVATE_KEY` repo secrets — a maintainer needs to have created a GitHub App, installed it on this repo, and populated those secrets for the workflow to run.
