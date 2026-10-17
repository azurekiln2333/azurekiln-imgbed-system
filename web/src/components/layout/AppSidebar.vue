<script setup>
/**
 * Collapsible application sidebar.
 *
 * Desktop: expanded rail (16rem) <-> icon-only rail (4rem) driven by
 * `collapsed`, animated with a `width` transition.
 * Mobile: off-canvas drawer that slides in/out with `transform`.
 *
 * Deliberately minimal — no "new asset" CTA, no workspace info card and no
 * user card at the bottom; the account menu lives in the top bar.
 */
import { navItems } from './nav'

const props = defineProps({
  active: { type: String, required: true },
  collapsed: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'close'])
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-20 flex flex-col border-r border-outline-variant/40 bg-surface-container-low transition-[transform,width] duration-300 ease-out dark:bg-slate-900 lg:z-40 lg:translate-x-0"
    :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', collapsed ? 'w-16' : 'w-64']"
    aria-label="主导航"
  >
    <div class="flex h-16 shrink-0 items-center gap-2 border-b border-outline-variant/40 px-3">
      <span class="w-9 h-9 rounded-lg primary-gradient flex items-center justify-center text-white shrink-0" aria-hidden="true">
        <span class="material-symbols-outlined text-xl">photo_library</span>
      </span>
      <span class="min-w-0 flex-1 overflow-hidden transition-opacity duration-200" :class="collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'">
        <span class="block text-sm font-bold truncate text-on-surface">数字馆长</span>
        <span class="block text-[10px] uppercase tracking-widest text-on-surface-variant truncate">Imgbed Console</span>
      </span>
      <button
        type="button"
        class="lg:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
        title="关闭菜单"
        aria-label="关闭菜单"
        @click="emit('close')"
      >
        <span class="material-symbols-outlined text-xl">close</span>
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2" aria-label="主菜单">
      <button
        v-for="item in navItems"
        :key="item.key"
        type="button"
        :aria-label="item.label"
        :aria-current="active === item.key ? 'page' : undefined"
        :title="collapsed ? item.label : undefined"
        class="w-full h-10 mb-1 flex items-center gap-3 px-3 rounded-lg text-sm font-semibold transition-colors text-left"
        :class="active === item.key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'"
        @click="emit('select', item.key)"
      >
        <span class="material-symbols-outlined text-xl shrink-0">{{ item.icon }}</span>
        <span class="overflow-hidden whitespace-nowrap transition-opacity duration-200" :class="collapsed ? 'opacity-0' : 'opacity-100'">{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
