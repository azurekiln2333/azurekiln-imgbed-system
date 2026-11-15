# Release Pipeline

> How every push is verified and how version tags become a published image.

---

## Trigger Matrix

| Event | Jobs that run |
|-------|---------------|
| Push to any branch | `test`, `web` |
| Pull request | `test`, `web` |
| Push of a `v*` tag | `test`, `web`, `image` |

The `image` job is gated on `github.ref` starting with `refs/tags/v` and depends on both test jobs, so a broken build can never reach the registry.

---

## Jobs

- **test** — `cd server && npm ci && npm test`. The tests inject fake database adapters, so no MySQL service is needed in CI.
- **web** — `cd web && npm ci && npm run build`. This mirrors exactly what the Dockerfile's `web-builder` stage does; the browser (Playwright) suite stays a local-only check.
- **image** — buildx build and push to `ghcr.io/${GITHUB_REPOSITORY,,}` (lowercase), logging in with the built-in `github.token`.

Node version comes from the root `.node-version` file (currently `22`) via `actions/setup-node` `node-version-file`. The `Dockerfile` `ARG NODE_VERSION` must be kept in sync with it manually.

---

## Image Tags

For a tag `vX.Y[-suffix]`:

- Always published: `ghcr.io/...:vX.Y[-suffix]`
- `latest` is added **only** when the version has no `-suffix` (no pre-releases in `latest`).

---

## Publishing a Release

```bash
git tag -a vX.Y.Z -m "azurekiln-imgbed vX.Y.Z: <summary>"
git push origin main vX.Y.Z
```

The GHCR package is **Public**, so the server and Watchtower pull it without registry credentials. Verify at `https://github.com/azurekiln2333/azurekiln-imgbed-system/pkgs/container/azurekiln-imgbed-system`.

---

## Common Mistakes

- Committing workflow changes while `.gitignore` still excludes `.github/` — the workflow silently never reaches GitHub. `.gitignore` re-includes `.github/workflows/` only; other Trellis platform files under `.github/` stay untracked on purpose.
- Forgetting that `latest` follows non-prerelease tags only: a `v3.1.0-beta.1` tag publishes `:v3.1.0-beta.1` but leaves `latest` (and therefore Watchtower) untouched.
