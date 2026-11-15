ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS web-builder

WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

# Debian nginx serves the console and proxies /api and /img to the local Node
# process. Drop the distro default site and stream logs into docker logs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default \
    && ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log

WORKDIR /app/server
ENV NODE_ENV=production \
    PORT=4000

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=web-builder /build/dist/ /app/web/dist/
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
# The API listens on 127.0.0.1:4000 and nginx fronts it on port 80. Any HTTP
# response counts as alive; only connection failures fail the check, so an
# unreachable database still reports a working console.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "-e", "const ping = u => fetch(u, { signal: AbortSignal.timeout(4000) }).then(() => true).catch(() => false); Promise.all([ping('http://127.0.0.1:4000/'), ping('http://127.0.0.1:80/')]).then(r => process.exit(r.every(Boolean) ? 0 : 1))"]

# nginx daemonizes, then node takes over as PID 1. A node crash exits the
# container so the compose restart policy brings it back.
CMD ["sh", "-c", "nginx && exec node app.js"]
