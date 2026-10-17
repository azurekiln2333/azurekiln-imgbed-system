# Component Guidelines

> How components are built in `web/`.

---

## Overview

Single-file components, `<script setup>` first, `<template>` second, no
`<style scoped>` — all styling is Tailwind utility classes resolved against the
tokens in `web/tailwind.config.js` plus the few helpers in `web/src/style.css`
(`.primary-gradient`, `.bg-glass`).

---

## Component Structure

```vue
<script setup>
import { onMounted, ref } from 'vue'
import { request } from '../api'

const rows = ref([])
const error = ref('')
const loading = ref(false)

async function loadRows() {
  loading.value = true
  error.value = ''
  try {
    rows.value = (await request('/rows')).data || []
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

onMounted(loadRows)
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-2xl font-bold text-on-surface">页面标题</h2>
    <p v-if="error" role="alert" class="p-3 bg-error/10 text-error rounded-lg text-sm">{{ error }}</p>
    <p v-if="loading" class="text-sm text-on-surface-variant">加载中…</p>
    <p v-else-if="!rows.length" class="text-sm text-on-surface-variant">暂无数据</p>
    <div v-else class="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4">
      …
    </div>
  </section>
</template>
```

Views are `section`-rooted and render exactly one `h2`; the shell (`<aside>`,
`<header>`, `<main>`) is owned by `DashboardView.vue`.

---

## Props Conventions

- Runtime `defineProps` objects with `type` and `default`; no TypeScript.
  ```js
  const props = defineProps({ collapsed: { type: Boolean, default: false } })
  ```
- Objects and arrays use a factory default: `default: () => ({})`.
- Data flows down via props, decisions flow up via `defineEmits`
  (`select`, `close`, `toggle-sidebar`, `update:search`, `logout`). Never
  mutate a prop.
- Boolean/string/number from the API is normalised with `Number()` before
  comparison — MySQL may return `"1"` rather than `1`.

---

## Styling Patterns

- Card: `bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5`.
- Primary button: `rounded-lg primary-gradient text-white font-bold` or
  `bg-primary text-white rounded-lg`.
- Secondary button: `bg-surface-container-high rounded-lg`.
- Danger: `text-error` / `bg-error text-white`, always behind a confirm.
- Field: `bg-surface-container-highest border-none rounded-lg px-3 py-2.5 text-sm`
  with a `text-xs font-bold uppercase text-on-surface-variant` label bound by
  `for`/`id`.
- Badge: `rounded px-2 py-0.5 text-[11px]` (never `rounded-full`).
- Never exceed `rounded-lg` (0.5rem); see `design-tokens.md`.

---

## Accessibility

- Icon-only buttons need `aria-label`; add `title` when a tooltip helps.
- Navigation items expose `aria-current="page"` when active and keep their
  label in icon-only mode.
- Drawer close/toggle labels must describe the action
  (`展开侧边栏` / `收起侧边栏`), not the state.
- Modal-ish surfaces use `role="dialog"` + `aria-modal="true"` + `aria-label`,
  and `Escape` closes them.
- Alerts use `role="alert"`, transient success uses `role="status"`.
- Tabs use `role="tablist"` / `role="tab"` with `aria-selected`.

---

## Common Mistakes

- Rendering the page title in the top bar as well as the view (duplicate H2).
- Adding a sidebar CTA or a user card at the bottom of the sidebar — the
  account menu is the only place for identity/logout.
- Trying to close the mobile drawer from a button that the drawer covers:
  the drawer is `z-20`, the top bar `z-30`.
- Repeating a status label that already exists in the heading.
- Leaving a card header with dividers on both sides, or a second progress bar
  for the same metric.
