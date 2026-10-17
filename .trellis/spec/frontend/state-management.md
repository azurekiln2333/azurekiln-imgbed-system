# State Management

> How state is managed in `web/` (Vue 3 Composition API, no store library).

---

## Overview

The app deliberately has no Vuex/Pinia and no Vue Router.

- `web/src/App.vue` holds one ref: the current pathname. It decides between
  `AuthView` (`/login`, `/register`) and `DashboardView`. Guards run once at
  startup: an unauthenticated visit to any console path redirects to `/login`.
- `web/src/components/DashboardView.vue` holds the console view key
  (`upload` / `gallery` / `tokens` / `settings`), the sidebar `collapsed` and
  `mobileOpen` flags, the header search input, and emits `navigate` upward for
  logout.

---

## State Categories

| Kind | Where | Example |
|------|-------|---------|
| Session | `localStorage` | `auth_token`, `user_info`, `sidebar_collapsed` |
| Shell state | `DashboardView.vue` refs | `view`, `collapsed`, `mobileOpen`, `search` |
| Server data | per-view `ref`s, loaded in `onMounted` | `tokens`, `images`, `providers`, `mounts` |
| Form state | `reactive()` / `ref()` local to the view | `providerForm`, `mountForm`, `name` |
| Derived | `computed()` | `activeMounts`, `mainMounts`, `pagination`, `roleLabel` |

---

## When to Use Global State

Only for things the whole shell needs. Today that is exactly: the auth token,
the cached user profile, and the sidebar collapse preference. Everything else
stays inside the view that renders it. If a second consumer appears, lift it
into `DashboardView.vue` first — a store is the last resort.

---

## Server State

- Always go through `request()` (`web/src/api.js`). It prefixes `/api`, adds
  `Authorization: Bearer <auth_token>`, and on `401` clears the session and
  redirects to `/login`.
- Load on mount, then refresh explicitly after a mutation
  (`await loadTokens()` after create/toggle/delete) — no hidden caches, no
  polling.
- Every view renders the loading and empty branches: `loading` → "加载中…",
  no rows → an explicit empty message. Never leave a blank panel.
- Errors surface in an inline `<p role="alert">` bound to a local `error` ref.
  Do not `alert()`; `window.confirm` is still used for destructive actions.

---

## Common Mistakes

- Reading `localStorage` at module scope without a `try/catch`: `JSON.parse`
  throws on corrupt or absent `user_info`. Use
  `try { … } catch { /* invalid cached profile */ }` as the views do.
- Forgetting to reset `document.body.style.overflow` when a dialog is unmounted
  (`GalleryView` restores it in both `closeModal` and `onUnmounted`).
- Assuming a numeric API field is a number. MySQL returns `status`,
  `is_public`, `is_backup` as strings in some paths — wrap with `Number()`.
- Mutating props. Views receive data through props (`query`) and emit changes
  upward; they never write to `props.*`.
