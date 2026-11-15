# Deployment Guidelines

> Release pipeline, container image and server deployment contracts.

---

## Overview

This directory records how the system is built, released and deployed. The pipeline lives in `.github/workflows/build-and-release.yml`, the image in `Dockerfile`, and the server-side runtime in `docker-compose.yaml` plus a root `.env` (see `.env.example`).

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Release Pipeline](./release-pipeline.md) | GitHub Actions jobs, version tags, GHCR image publishing | Filled |
| [Docker Deployment](./docker-deployment.md) | All-in-one image, bridge networking to host MySQL, Watchtower | Filled |

---

**Language**: All documentation should be written in **English**.
