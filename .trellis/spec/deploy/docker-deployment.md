# Docker Deployment

> How the container is assembled, how it reaches host MySQL over bridge networking, and how updates roll out.

---

## All-in-One Image

One image runs both nginx and the Node API in the same network namespace:

- nginx serves `/app/web/dist` (built in the `web-builder` stage) and proxies `/api/` and `/img/` to `127.0.0.1:4000` via `deploy/nginx.conf` mounted at `/etc/nginx/conf.d/default.conf`.
- Entry point: `nginx` daemonizes, then `exec node app.js` — node is PID 1, so a node crash exits the container and `restart: unless-stopped` recovers it.
- `HEALTHCHECK` accepts **any** HTTP response from both `127.0.0.1:4000` and `127.0.0.1:80` as alive; only connection failures fail it, so an unreachable database still reports healthy.

**Why one container:** `server/app.js` hardcodes `app.listen(port, '127.0.0.1')`. Same-container localhost proxying needs zero backend changes. Do not split nginx and node into two containers unless the listen host is made configurable first.

Uploads persist through the `./uploads:/app/server/uploads` volume; multer writes to the relative `uploads/` path. `.dockerignore` excludes `**/.*` (dotfiles = secrets), `**/node_modules`, `**/dist` and `**/uploads` — `web/dist` is rebuilt inside the image.

---

## Bridge Networking to Host Services

The compose service uses the default bridge network plus:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

The container reaches host MySQL and host AList through `host.docker.internal`. Host networking is not used and not needed. Host prerequisites:

1. `mysqld` `bind-address=0.0.0.0` (the default `127.0.0.1` is the one way this breaks).
2. Account allowed from container networks: `CREATE USER 'imgbed'@'%' IDENTIFIED BY '...'; GRANT ALL ON imagehost.* TO 'imgbed'@'%';`

---

## Compose Environment Contract

| Variable | Meaning |
|----------|---------|
| `IMGBED_IMAGE` | Image reference, default `ghcr.io/azurekiln2333/azurekiln-imgbed-system:latest` |
| `IMGBED_BIND_HOST` / `IMGBED_PORT` | Host-side publish target, default `127.0.0.1:8080` behind host nginx; `0.0.0.0` for direct exposure |
| `PORT` | Fixed to `4000` in compose `environment`; do not change |
| `DB_*`, `JWT_*`, `ALIST_*` | Passed through `env_file: .env`; `DB_HOST` and `ALIST_URL` use `host.docker.internal` |
| `WATCHTOWER_POLL_INTERVAL` | Update check period in seconds, default 600 |

---

## Watchtower

The second compose service (`nickfedor/watchtower`, pinned) polls for new `latest` images and recreates the app container in place. Scope is enforced by labels (`com.centurylinklabs.watchtower.scope`), so it only touches containers carrying the matching label; Watchtower excludes itself with `enable: "false"`. Server-side update flow is therefore automatic: push a tag → CI publishes → Watchtower pulls and restarts within the poll interval. Manual override remains `docker compose pull && docker compose up -d`.
