# Design Tokens & Radius

> Visual contract for the `web/` Vue 3 + Tailwind 3 app. Everything here is
> verified by `web/tests/layout.spec.js`, so treat it as executable.

---

## Radius scale (`--radius: 0.5rem`)

The design follows New API's MD3 `md` step. **Nothing bigger than 0.5rem.**

| Element | Tailwind | px |
|---------|----------|----|
| Cards, panels, inputs, selects, buttons, tabs, dropdowns | `rounded-lg` | 8 |
| Small elements: badges, chips, tiny icon buttons | `rounded` / `rounded-md` | 4–6 |
| Image thumbnails inside cards (`<img>` only) | `rounded` | 4 |
| Avatars | `rounded-full` | circular only |

`web/tailwind.config.js` clamps the whole scale, so an accidental
`rounded-xl`/`rounded-2xl`/`rounded-3xl` still renders at 0.5rem:

```js
borderRadius: {
  sm: '0.25rem',
  DEFAULT: '0.375rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.5rem',
  '2xl': '0.5rem',
  '3xl': '0.5rem'
}
```

The clamp is a safety net, not a licence: **do not write** `rounded-xl`,
`rounded-2xl` or `rounded-3xl`. Grep must stay empty:

```powershell
Select-String -Path web/src/**/*.vue, web/src/*.css, web/index.html -Pattern "rounded-(xl|2xl|3xl)"
```

`rounded-full` is reserved for the account avatar. Pill-shaped status badges
are not allowed — use `rounded` (4px) with `px-2 py-0.5`.

---

## Colour tokens

`web/tailwind.config.js` owns the palette and it must not drift:
`primary #004ac6`, `primary-container #2563eb`, `surface #f7f9fb`,
`surface-container-low/lowest/high/highest`, `on-surface`,
`on-surface-variant`, `outline`, `outline-variant`, `error`,
`error-container`, `tertiary-container`. `.primary-gradient`
(`135deg, #004ac6 → #2563eb`) comes from `web/src/style.css` and is used for
the brand mark and primary CTAs.

---

## Motion

Sidebar transitions are 300 ms `ease-out`; opacity fades are 200 ms. Do not
use a duration above 300 ms for state changes. `web/src/style.css` shortens
every transition when `prefers-reduced-motion: reduce` is set, so never
implement motion in JS timers that bypass CSS transitions.
