# Type Safety

> `web/` is plain JavaScript. Safety comes from a narrow runtime boundary, not
> from a type checker.

---

## Overview

No TypeScript, no `jsconfig` type checking, no schema validator. The single
typed boundary is the HTTP layer in `web/src/api.js`; everything a view renders
is normalised right after the response resolves.

---

## Normalisation Rules

| Source | Rule | Example |
|--------|------|---------|
| Numeric flags from MySQL (`status`, `is_public`, `is_backup`) | `Number(x)` before `=== 1` | `Number(mount.is_public) === 1 ? '公共' : '私有'` |
| Counters/bigints (`total_size`, `file_size`) | `Number(x \|\| 0)` before arithmetic | `(Number(stats.total_size \|\| 0) / 1024 / 1024).toFixed(2)` |
| List payloads | `data.data \|\| []` | `tokens.value = (await request('/tokens')).data \|\| []` |
| Timestamps | guard invalid dates | `formatDate()` returns `从未使用` / `—` |
| Cached profile | `try/catch` around `JSON.parse(localStorage…)` | `user_info` |
| Optional strings | `?.` + fallback | `image.mime_type?.split('/').pop() \|\| 'IMG'` |

---

## Where Validation Happens

- **Client-side pre-checks** exist only to give fast feedback and mirror the
  server rules: required fields, `maxlength="50"` on token names, password
  confirmation on register, accepted file MIME types and 50 MB cap on upload.
- **Authoritative validation is server-side.** Never rely on a client check for
  security or uniqueness; the client must still surface the server's
  `{ error }` message.
- `request()` always attempts `response.json()` and falls back to `{}`, so a
  view receives an object even for an empty body. Errors become
  `new Error(data.error || '请求失败 (status)')`.

---

## Common Mistakes

- Comparing an API flag with `=== 1` without `Number()` — string `"1"` fails.
- Calling `.toFixed()` on an undefined numeric field.
- Trusting `localStorage.user_info` to be valid JSON after a manual edit.
- Assuming `data.data` exists for endpoints that return `{ success: true }`.
- Assuming `pages`/`total_images` are numbers (they can arrive as strings).
