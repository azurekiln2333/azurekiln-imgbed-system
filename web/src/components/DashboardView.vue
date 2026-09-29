<script setup>
import { ref } from 'vue'
import UploadView from './UploadView.vue'
import GalleryView from './GalleryView.vue'
import SettingsView from './SettingsView.vue'

const emit = defineEmits(['navigate'])
const view = ref('upload')
const sidebarOpen = ref(false)
const search = ref('')
const galleryQuery = ref('')
const galleryVersion = ref(0)
let user = {}
try { user = JSON.parse(localStorage.getItem('user_info') || '{}') } catch { /* invalid cached profile */ }

function switchView(next) {
  view.value = next
  sidebarOpen.value = false
  if (next === 'gallery') galleryVersion.value++
}

function searchImages() {
  galleryQuery.value = search.value.trim()
  switchView('gallery')
}

function logout() {
  if (!window.confirm('确定要退出登录吗？')) return
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_info')
  emit('navigate', '/login')
}
</script>

<template>
  <div class="min-h-screen bg-surface">
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/50 z-40 lg:hidden" @click="sidebarOpen = false"></div>
    <aside class="h-screen w-64 fixed left-0 top-0 bg-slate-50 flex flex-col py-8 px-4 z-50 border-r border-slate-200 transform lg:translate-x-0 transition-transform duration-300" :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'">
      <div class="mb-10 px-2 flex items-center justify-between">
        <div><h1 class="text-xl font-bold text-slate-900">数字馆长</h1><p class="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">技术工作站</p></div>
        <button class="lg:hidden p-2 rounded-lg hover:bg-slate-200" title="关闭菜单" @click="sidebarOpen = false"><span class="material-symbols-outlined text-slate-500">close</span></button>
      </div>
      <nav class="flex-1 space-y-2" aria-label="主导航">
        <button v-for="item in [{ key: 'upload', icon: 'cloud_upload', label: '上传' }, { key: 'gallery', icon: 'photo_library', label: '图库' }, { key: 'settings', icon: 'settings', label: '设置' }]" :key="item.key" type="button" :aria-label="item.label" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors text-left" :class="view === item.key ? 'text-blue-600 border-r-2 border-blue-600 bg-slate-200/50' : 'text-slate-500 hover:bg-slate-200/50'" @click="switchView(item.key)">
          <span class="material-symbols-outlined">{{ item.icon }}</span><span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="mt-auto px-2">
        <button class="w-full py-3 px-4 rounded-lg primary-gradient text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90" @click="switchView('upload')"><span class="material-symbols-outlined text-sm">add</span> 新建资产</button>
        <button class="mt-8 w-full flex items-center gap-3 text-left" title="退出登录" @click="logout">
          <span class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">{{ (user.username || 'U').charAt(0).toUpperCase() }}</span>
          <span class="overflow-hidden flex-1"><span class="block text-xs font-bold truncate">{{ user.username || '用户名' }}</span><span class="block text-[10px] text-slate-500 truncate">专业账户</span></span>
          <span class="material-symbols-outlined text-sm text-slate-400">logout</span>
        </button>
      </div>
    </aside>

    <header class="fixed top-0 right-0 left-0 lg:left-64 h-16 z-30 bg-white/80 backdrop-blur-xl flex justify-between items-center px-4 lg:px-8 shadow-sm">
      <div class="flex items-center gap-4 flex-1 min-w-0">
        <button class="lg:hidden p-2 rounded-lg hover:bg-slate-100" title="打开菜单" @click="sidebarOpen = true"><span class="material-symbols-outlined text-2xl text-slate-600">menu</span></button>
        <form class="relative flex-1 max-w-xl hidden sm:block" @submit.prevent="searchImages">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
          <input v-model="search" class="w-full bg-surface-container-highest border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/40" placeholder="搜索资产、标签或维度..." type="search" aria-label="搜索图片" />
        </form>
      </div>
      <button class="primary-gradient text-white px-4 lg:px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:opacity-90" @click="switchView('upload')">快速上传</button>
    </header>

    <main class="lg:ml-64 pt-20 lg:pt-24 px-4 lg:px-10 pb-12 min-h-screen">
      <UploadView v-if="view === 'upload'" />
      <GalleryView v-else-if="view === 'gallery'" :key="galleryVersion" :query="galleryQuery" />
      <SettingsView v-else />
    </main>
  </div>
</template>
