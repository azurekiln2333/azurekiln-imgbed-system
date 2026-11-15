# Azurekiln ImgBed System

数字馆长图床系统。`web/` 是 Vue 3 + Vite 前端，`server/` 是 Node.js + Express API。前端构建产物是静态文件，运行时不需要 PHP。

## 本地开发

1. 安装 Node.js 20.19+，准备 MySQL 和 AList。
2. 在 MySQL 中执行 `server/database.sql`。已有旧版数据库时，按实际版本执行 `server/migrate-*.sql`，先备份数据。
3. 复制 `server/.env.example` 为 `server/.env`，填写数据库、JWT 和 AList 配置。`.env` 不会提交到 Git。
4. 运行后端：`cd server && npm ci && npm start`。默认监听 `127.0.0.1:4000`。
5. 运行前端：`cd web && npm ci && npm run dev`。打开 Vite 输出的地址。

Vite 将 `/api` 和 `/img` 代理到后端，默认目标为 `http://127.0.0.1:4000`。若后端端口不同，启动 Vite 前设置 `API_TARGET`。

## 部署

在 `web/` 执行 `npm ci && npm run build`，将 `web/nginx.conf` 中的域名与 `root` 改为实际值后启用。Nginx 服务 Vue 页面，并将 `/api/`、`/img/` 转发到后端。前端使用同源路径，不需要把 API 地址或密钥写入构建产物。

### Docker 部署

CI 在推送 `v*` tag 时构建 all-in-one 镜像（容器内 nginx 服务前端并代理本机 Node API）并发布到 GHCR。服务器上：

1. 把 `docker-compose.yaml`、`.env.example` 复制到部署目录，`.env.example` 复制为 `.env` 并填写 JWT、数据库和 AList。宿主机 Nginx 将站点反代到 `127.0.0.1:8080`；需要直接访问时把 `IMGBED_BIND_HOST` 改为 `0.0.0.0`。
2. 宿主机 MySQL 放行 Docker 网桥：`bind-address=0.0.0.0`，账号允许容器网段登录（如 `'imgbed'@'%'`）。容器走桥接网络，通过 `host.docker.internal`（compose 已配置 `host-gateway`）访问宿主机，不需要 host 网络模式。
3. 启动：`docker compose pull && docker compose up -d`。上传的图片保存在部署目录的 `./uploads`。
4. Watchtower 已内置在 compose 中，按 `WATCHTOWER_POLL_INTERVAL`（默认 10 分钟）自动检查新镜像并重建容器，无需手动 pull。
5. 首次发布后 GHCR 包默认私有：在 GitHub 的 Packages 页面把它改为 Public，或在服务器上 `docker login ghcr.io` 后再 pull。

公开注册调用 `POST /api/auth/register`；登录调用 `POST /api/auth/login`。上传、图库、描述更新、备份和存储设置使用现有 `/api` 路由。图片直链统一为 `/img/<image_key>`。

## 仓库约定

根目录是唯一用于此系统的 Git 仓库。`web/` 和 `server/` 的旧 Git 元数据保存在当前机器的 `.git-archives/`，该目录不会推送；旧历史也可从各自原远端获取。提交消息使用 Conventional Commits，例如 `feat(web): migrate dashboard to Vue`、`fix(server): preserve provider credentials on edit`。
