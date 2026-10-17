# Frontend Development Guidelines

> Conventions for `web/`, a Vue 3 + Vite + Tailwind 3 console that mirrors the
> New API layout. These docs describe the code as it actually is and are
> enforced by `web/tests/`.

---

## Overview

Single-page Vue 3 app, Composition API with `<script setup>`, no router and no
store. `App.vue` picks between auth and console by pathname; `DashboardView.vue`
composes the shell (sidebar + top bar + content) and owns the active view key.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Design Tokens & Radius](./design-tokens.md) | `--radius: 0.5rem` scale, palette, motion | Done |
| [Layout Conventions](./layout-conventions.md) | Shell anatomy, sidebar/top bar rules, z-index, page title rules | Done |
| [Directory Structure](./directory-structure.md) | File layout and naming | Done |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, accessibility | Done |
| [State Management](./state-management.md) | Local vs shell state, server data, error/empty handling | Done |
| [Quality Guidelines](./quality-guidelines.md) | Verification gate, forbidden patterns, testing | Done |
| [Type Safety](./type-safety.md) | Where runtime validation happens | Done |
| [Hook Guidelines](./hook-guidelines.md) | Server data access via `request()` | Done |

---

## Reading Order

1. `design-tokens.md` and `layout-conventions.md` before touching any markup.
2. `quality-guidelines.md` before claiming a change is finished — it lists the
   exact commands and the review checklist.
3. `directory-structure.md` / `state-management.md` before adding a new view.

---

**Language**: All documentation should be written in **English**.
