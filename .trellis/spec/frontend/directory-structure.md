# Directory Structure

> Layout of the `web/` Vue 3 + Vite + Tailwind app.

---

## Directory Layout

```
web/
├── index.html              # Fonts + #app mount point
├── playwright.config.js    # E2E config (msedge, 127.0.0.1:5175)
├── tailwind.config.js      # Design tokens: colours, fonts, clamped radii
├── vite.config.js          # Dev proxy /api and /img → API_TARGET
├── src/
│   ├── main.js             # createApp(App)
│   ├── App.vue             # Path-based routing (/login, /register, else console)
│   ├── api.js              # request() wrapper: base /api, bearer auth, 401 → /login
│   ├── style.css           # Tailwind layers, --radius, motion prefs
│   └── components/
│       ├── DashboardView.vue    # Shell: sidebar + top bar + <main>, owns view state
│       ├── layout/
│       │   ├── AppSidebar.vue   # Navigation rail / mobile drawer
│       │   ├── AppHeader.vue    # Toggle, search, account menu
│       │   └── nav.js           # { key, icon, label } nav model
│       ├── AuthView.vue         # Login + register (`mode` prop)
│       ├── UploadView.vue       # Drag-drop queue, mount picker, link extraction
│       ├── GalleryView.vue      # Grid, pagination, detail dialog, backups
│       ├── TokensView.vue       # API token list / create / copy / toggle / delete
│       └── SettingsView.vue     # Providers and mounts tabs
└── tests/
    ├── setup.js            # Starts the Vite dev server for Playwright
    ├── workflows.spec.js   # Auth, upload, gallery, settings, mobile
    └── layout.spec.js      # Shell, drawer, account menu, tokens, radii
```

---

## Module Organization

- One view per console section, kept flat in `web/src/components/`; only
  shell chrome lives in `web/src/components/layout/`.
- A new console section = new `*View.vue` + one entry in
  `web/src/components/layout/nav.js` + one `v-else-if` branch in
  `DashboardView.vue`. Keys are `upload` / `gallery` / `tokens` / `settings`.
- There is **no router and no store**. `App.vue` owns the top-level path,
  `DashboardView.vue` owns the console view key. Do not introduce Vue Router
  or Pinia without updating this spec and `state-management.md`.
- All HTTP goes through `request()` in `web/src/api.js`; raw `fetch` is only
  acceptable for XHR upload progress (`UploadView.vue`).

---

## Naming Conventions

| Kind | Convention | Example |
|------|------------|---------|
| View component | PascalCase `*View.vue` | `TokensView.vue` |
| Layout component | PascalCase `App*.vue` under `layout/` | `AppSidebar.vue` |
| Test id / hook | `id` attribute for form fields | `id="upload-mount"`, `id="token-name"` |
| Route key | lowercase noun | `upload`, `gallery`, `tokens`, `settings` |
| API helper | verb + resource | `loadMounts`, `createToken`, `saveDescription` |
