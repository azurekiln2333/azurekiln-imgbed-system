# Hook Guidelines

> There are no React-style hooks in `web/`. This file documents the equivalent
> reusable units: the API wrapper and the Composition-API helpers.

---

## Overview

Data access lives in exactly one place — `web/src/api.js`:

```js
export const imageUrl = key => `${window.location.origin}/img/${encodeURIComponent(key)}`

export async function request(path, { method = 'GET', body, auth = true } = {}) {
  // adds Authorization: Bearer <auth_token> unless auth:false,
  // JSON-encodes body, clears the session and redirects to /login on 401,
  // throws Error(data.error || `请求失败 (${status})`) on !ok
}
```

Rules:

- Every JSON call goes through `request()`. Do not call `fetch` directly.
- `auth: false` is only for the public auth routes (`/auth/login`,
  `/auth/register`).
- Use `imageUrl(key)` for every `<img src>`; never concatenate `/img/` by hand.
- The one sanctioned exception is the upload transport in
  `UploadView.vue`, which must use `XMLHttpRequest` to report progress and sets
  `Authorization` from `localStorage.auth_token` itself.

---

## Composition-API Primitives In Use

| Primitive | Where | Why |
|-----------|-------|-----|
| `onMounted(load…)` | every view | initial fetch |
| `onUnmounted` | `UploadView` (revoke object URLs), `GalleryView` (remove keydown listener, restore body scroll), `AppHeader` (remove listeners) | no leaks |
| `watch(() => props.query, …)` | `GalleryView` | header search re-queries page 1 |
| `computed` | `activeMounts`, `mainMounts`, `pagination`, `roleLabel`, `toggleLabel` | derived only, never side effects |
| `window.matchMedia('(max-width: 1023px)')` + `change` listener | `AppHeader` | labels the toggle for desktop vs drawer |

When registering a global listener (`document`, `window`, `matchMedia`), mirror
it with the same function reference in `onBeforeUnmount`/`onUnmounted`.

---

## Common Mistakes

- Kicking off a request inside `computed()` — it re-runs on every render.
- Forgetting to remove a `keydown` listener, so `Escape` closes a dialog that
  is no longer mounted.
- Creating object URLs for previews without `URL.revokeObjectURL`.
- Calling an endpoint's absolute URL (`/api/...`): `request()` already adds the
  `/api` prefix, so pass `/tokens`, not `/api/tokens`.
- Depending on `navigator.clipboard` alone; `TokensView` falls back to a
  temporary textarea and reports a copy error instead of throwing.
