# Quality Guidelines

> Code quality standards for `web/`.

---

## Overview

There is no linter or type checker in this package. The gate is:

| Check | Command | Must |
|-------|---------|------|
| Production bundle | `cd web && npx vite build --outDir ../.tmp-build-<name> --emptyOutDir` | pass, then delete the temp dir |
| Browser workflows | `cd web && npm test` (Playwright, `msedge`) | pass |
| API | `cd server && npm test` (`node --test`) | pass |
| Radius grep | see `design-tokens.md` | no `rounded-xl|2xl|3xl` |

Never write to `web/dist` during verification; use a temporary `outDir`.

---

## Forbidden Patterns

- `rounded-xl`, `rounded-2xl`, `rounded-3xl` — the scale is clamped to
  `0.5rem`, and `rounded-full` is avatar-only. See `design-tokens.md`.
- A page title in the top bar, or the same title rendered twice in one view.
  See `layout-conventions.md`.
- Duplicate CTAs for the same destination (sidebar "新建资产" + header
  "快速上传"), console footers, or admin/workspace info cards in the sidebar.
- Divider above *and* below one card header; duplicated progress/quota bars.
- Blank panels or "not found" text where an empty state belongs.
- A mobile drawer stacked above the top bar (breaks the close affordance).
- `alert()` for errors, raw `fetch` for JSON calls (use `request()`).
- Emitting network calls from `computed()` or the template.

## Required Patterns

- Each view: one `h2.text-2xl.font-bold`, optional one-line description,
  then `space-y-4` sections built from
  `bg-surface-container-lowest border border-outline-variant/40 rounded-lg`.
- Every interactive element carries an accessible name: visible text, or
  `aria-label` (+ `title` where a tooltip helps). Icon-only buttons **must**
  have both.
- Destructive actions confirm first (`window.confirm`) and the button is
  `text-error`.
- API results are normalised with `Number()` before comparing status flags.
- Empty/loading/error branches are implemented for every asynchronous panel.

## Testing Requirements

`web/tests/*.spec.js` run against a real Vite dev server (`tests/setup.js`,
port 5175) with `page.route()` fakes for `/api/**`. Keep assertions
user-visible.

- `workflows.spec.js` — registration/login through the public auth routes,
  upload → gallery description `PATCH` → settings tabs, mobile layout.
- `layout.spec.js` — desktop collapse transition, mobile drawer slide, account
  menu contents and position, single heading per view, token CRUD + clipboard,
  and a computed-style scan for radii above `0.5rem`.

When UI markup changes, update the selector in the same commit; do not weaken
a test to make it pass. Prefer role/label queries (`getByRole`,
`getByLabel`) over CSS paths.

## Code Review Checklist

- [ ] Build passes into a temp `outDir` and the directory is removed
- [ ] `web npm test` and `server npm test` green
- [ ] Radius grep empty; no new `rounded-full` outside the avatar
- [ ] One page title; no duplicated CTA, footer or info card
- [ ] Sidebar collapse + mobile drawer still animate and stay clickable
- [ ] Account menu still holds username, role and logout
- [ ] Token page still lists, creates, copies, toggles and deletes
- [ ] Empty states present for every async panel
- [ ] Only the files you own are staged; commit message follows
      Conventional Commits (`feat(web): …`, `fix(web): …`, `test(web): …`)
