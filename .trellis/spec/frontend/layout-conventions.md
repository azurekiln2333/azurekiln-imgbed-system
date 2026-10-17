# Layout Conventions

> Shell structure for the authenticated console. Mirrors New API's
> `components/layout` with a fixed top bar, a collapsible sidebar and a
> single scrolling content panel.

---

## Shell anatomy

`web/src/components/DashboardView.vue` is the only place that composes the
shell. It owns state; children stay presentational.

| Part | File | Responsibility |
|------|------|----------------|
| Shell / view switching | `web/src/components/DashboardView.vue` | `view` (`upload`/`gallery`/`tokens`/`settings`), `collapsed`, `mobileOpen`, search query, logout |
| Sidebar | `web/src/components/layout/AppSidebar.vue` | Brand mark, navigation, mobile close button |
| Top bar | `web/src/components/layout/AppHeader.vue` | Collapse/menu toggle, search, account dropdown |
| Nav model | `web/src/components/layout/nav.js` | `{ key, icon, label }` — `key` is the contract with `DashboardView` |

DOM order is: optional backdrop → `<aside>` → content column
(`<header>` + `<main>`).

---

## Sidebar rules

- **Desktop (`lg` and up):** `w-64` expanded ↔ `w-16` icon-only rail,
  animated with `transition-[transform,width] duration-300 ease-out`. The
  content column mirrors it with `lg:pl-64` / `lg:pl-16`. The collapsed
  preference is persisted in `localStorage.sidebar_collapsed`.
- **Mobile (below `lg`):** off-canvas drawer, `-translate-x-full` ↔
  `translate-x-0`, same transition, closed by the backdrop, the in-drawer
  close button, `Escape`, or picking a destination.
- Icon-only rail keeps every item's accessible name (`aria-label` plus
  `title`) and its active state (`aria-current="page"`).
- **Never** put product/profile chrome in the sidebar: no "new asset" CTA, no
  workspace or admin info card, no user card at the bottom.

## Top bar rules

- Renders **no page title** and **no duplicate CTA** ("quick upload" etc.).
  It only holds the sidebar toggle, the search form and the account menu.
- The account menu (top-right avatar button) owns username, role label and
  logout. It closes on outside pointerdown and on `Escape`.
- The toggle's accessible name always describes the action it performs:
  desktop `展开侧边栏` / `收起侧边栏`, mobile `展开侧边栏` / `收起侧边栏`
  depending on the drawer state.

## Stacking order (keep it)

| z-index | Layer |
|---------|-------|
| 10 | mobile backdrop |
| 20 | mobile drawer `<aside>` |
| 30 | sticky top bar |
| 40 | desktop `<aside>` and overlays |
| 100 | full-screen dialogs (gallery detail) |

The top bar must stay clickable while the mobile drawer is open — that is why
the drawer sits at `z-20` and only rises to `z-40` from `lg` upwards.

---

## Page content rules

- **One page title per view.** Each view renders exactly one
  `<h2 class="text-2xl font-bold">`; never repeat the same words in the top
  bar, a card header or a section label.
- A short `text-sm text-on-surface-variant` sentence may follow the title;
  it must not restate the title verbatim.
- Section headings inside a view are demoted: `.text-base`/`.text-sm` bold,
  or an uppercase tracking label — never a second `text-2xl`.
- No console footer ("AzureKiln · 管理控制台") anywhere.
- No divider above *and* below a card header: use a single
  `border-b border-outline-variant/40` or none.
- No duplicated progress or quota bars on one page.
- Every view must survive empty data: an explicit empty state
  ("暂无…"/"还没有…"), never a blank panel or a "not found" string.
- Search moves the user to the gallery with `query`; the header itself never
  renders results.

---

## Content spacing

`<main class="min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">`. Cards follow
`bg-surface-container-lowest border border-outline-variant/40 rounded-lg
p-4 sm:p-5`; grids use `gap-4`.
