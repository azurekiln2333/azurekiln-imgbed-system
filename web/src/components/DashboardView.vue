<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppSidebar from './layout/AppSidebar.vue'
import AppHeader from './layout/AppHeader.vue'
import UploadView from './UploadView.vue'
import GalleryView from './GalleryView.vue'
import TokensView from './TokensView.vue'
import SettingsView from './SettingsView.vue'

const emit = defineEmits(['navigate'])

const view = ref('upload')
const collapsed = ref(false)
const mobileOpen = ref(false)
const search = ref('')
const galleryQuery = ref('')
const galleryVersion = ref(0)

const user = ref({})
try { user.value = JSON.parse(localStorage.getItem('user_info') || '{}') || {} } catch { /* invalid cached profile */ }
try { collapsed.value = localStorage.getItem('sidebar_collapsed') === '1' } catch { /* storage unavailable */ }

const contentOffset = computed(() => {
  if (collapsed.value) return 'lg:pl-16'
  return 'lg:pl-64'
})

function persistCollapsed() {
  try { localStorage.setItem('sidebar_collapsed', collapsed.value ? '1' : '0') } catch { /* storage unavailable */ }
}

function toggleSidebar() {
  // Below `lg` the sidebar lives in an off-canvas drawer; the same control
  // opens and closes it there.
  if (window.matchMedia('(max-width: 1023px)').matches) {
    mobileOpen.value = !mobileOpen.value
    return
  }
  collapsed.value = !collapsed.value
  persistCollapsed()
}

function selectView(next) {
  view.value = next
  mobileOpen.value = false
  if (next === 'gallery') galleryVersion.value++
}

function searchImages() {
  galleryQuery.value = search.value
  selectView('gallery')
}

function onKeydown(event) {
  if (event.key === 'Escape') mobileOpen.value = false
}

function logout() {
  if (!window.confirm('确定要退出登录吗？')) return
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_info')
  emit('navigate', '/login')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="min-h-screen bg-surface">
    <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" @click="mobileOpen = false"></div>

    <AppSidebar :active="view" :collapsed="collapsed" :mobile-open="mobileOpen" @select="selectView" @close="mobileOpen = false" />

    <div class="min-w-0 transition-[padding] duration-300 ease-out" :class="contentOffset">
      <AppHeader
        :collapsed="collapsed"
        :user="user"
        :search="search"
        @toggle-sidebar="toggleSidebar"
        @update:search="search = $event"
        @search="searchImages"
        @logout="logout"
      />

      <main class="min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <UploadView v-if="view === 'upload'" />
        <GalleryView v-else-if="view === 'gallery'" :key="galleryVersion" :query="galleryQuery" />
        <TokensView v-else-if="view === 'tokens'" />
        <SettingsView v-else-if="view === 'settings'" />
      </main>
    </div>
  </div>
</template>
