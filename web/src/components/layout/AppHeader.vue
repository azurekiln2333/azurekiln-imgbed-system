<script setup>
/**
 * Top bar: collapse/menu button, search, and the account dropdown.
 *
 * It intentionally does NOT render a page title — every view renders its own
 * single `h2` heading — and it has no duplicate CTA ("quick upload" etc).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false },
  user: { type: Object, default: () => ({}) },
  search: { type: String, default: '' }
})

const emit = defineEmits(['toggle-sidebar', 'update:search', 'search', 'logout'])

const menuOpen = ref(false)
const root = ref(null)
const isMobile = ref(false)
const mobileQuery = typeof window === 'undefined' ? null : window.matchMedia('(max-width: 1023px)')
const roleLabels = { admin: '管理员', user: '普通用户' }

const displayName = computed(() => props.user.username || '未登录')
const roleLabel = computed(() => roleLabels[props.user.role] || props.user.role || '普通用户')
const initial = computed(() => displayName.value.charAt(0).toUpperCase())

// Below `lg` the sidebar is an off-canvas drawer, so the same control opens
// and closes it; the label always names the action it will perform.
const toggleLabel = computed(() => {
  if (isMobile.value) return props.mobileOpen ? '收起侧边栏' : '展开侧边栏'
  return props.collapsed ? '展开侧边栏' : '收起侧边栏'
})
const toggleIcon = computed(() => {
  if (isMobile.value) return 'menu'
  return props.collapsed ? 'menu' : 'left_panel_close'
})

function syncIsMobile() {
  isMobile.value = Boolean(mobileQuery?.matches)
}

function onDocumentPointer(event) {
  if (menuOpen.value && root.value && !root.value.contains(event.target)) menuOpen.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') menuOpen.value = false
}

function submitSearch() {
  emit('search', props.search.trim())
}

onMounted(() => {
  syncIsMobile()
  mobileQuery?.addEventListener('change', syncIsMobile)
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', syncIsMobile)
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header class="sticky top-0 z-30 h-16 border-b border-outline-variant/40 bg-surface-container-lowest/85 backdrop-blur-xl">
    <div class="h-full flex items-center gap-2 px-3 sm:px-5">
      <button
        type="button"
        class="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
        :title="toggleLabel"
        :aria-label="toggleLabel"
        @click="emit('toggle-sidebar')"
      >
        <span class="material-symbols-outlined text-xl">{{ toggleIcon }}</span>
      </button>

      <form class="relative flex-1 max-w-xl hidden sm:block" role="search" @submit.prevent="submitSearch">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">search</span>
        <input
          :value="search"
          class="w-full bg-surface-container-highest border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/40"
          placeholder="搜索图片..."
          type="search"
          aria-label="搜索图片"
          @input="emit('update:search', $event.target.value)"
        />
      </form>

      <button
        type="button"
        class="sm:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
        title="搜索图片"
        aria-label="搜索图片"
        @click="emit('search', search.trim())"
      >
        <span class="material-symbols-outlined text-xl">search</span>
      </button>

      <div ref="root" class="relative ml-auto shrink-0">
        <button
          type="button"
          class="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-surface-container-high transition-colors"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          aria-label="账号菜单"
          title="账号菜单"
          @click="menuOpen = !menuOpen"
        >
          <span class="w-8 h-8 rounded-full primary-gradient text-white flex items-center justify-center text-sm font-bold">{{ initial }}</span>
          <span class="material-symbols-outlined text-lg text-on-surface-variant">{{ menuOpen ? 'expand_less' : 'expand_more' }}</span>
        </button>

        <div
          v-if="menuOpen"
          role="menu"
          class="absolute right-0 mt-2 w-56 rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-lg overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-outline-variant/40">
            <p class="text-sm font-bold truncate" :title="displayName">{{ displayName }}</p>
            <p class="text-xs text-on-surface-variant mt-0.5">{{ roleLabel }}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/10 text-left"
            @click="menuOpen = false; emit('logout')"
          >
            <span class="material-symbols-outlined text-lg">logout</span>
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
