<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { imageUrl, request } from '../api'

const props = defineProps({ query: { type: String, default: '' } })
const images = ref([])
const page = ref(1)
const pages = ref(0)
const stats = ref({ total_images: 0, total_size: 0 })
const loading = ref(false)
const error = ref('')
const selected = ref(null)
const description = ref('')
const backups = ref([])
const backupLoading = ref(false)
const actionBusy = ref(false)

const pagination = computed(() => Array.from({ length: pages.value }, (_, index) => index + 1))

async function load(nextPage = 1) {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: String(nextPage), limit: '12' })
    if (props.query) params.set('q', props.query)
    const [data, summary] = await Promise.all([request(`/images?${params}`), request('/stats')])
    images.value = data.data || []
    pages.value = data.pages || 0
    page.value = nextPage
    stats.value = summary
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text) }
  catch { error.value = '复制失败，请手动复制链接' }
}

async function remove(image) {
  if (!window.confirm('确定删除此图片吗？删除后无法恢复！')) return
  try {
    await request(`/images/${image.id}`, { method: 'DELETE' })
    closeModal()
    await load(page.value)
  } catch (err) { error.value = err.message }
}

function openModal(image) {
  selected.value = image
  description.value = image.description || ''
  document.body.style.overflow = 'hidden'
  loadBackups()
}

function closeModal() {
  selected.value = null
  document.body.style.overflow = ''
}

async function loadBackups() {
  if (!selected.value) return
  backupLoading.value = true
  try {
    const data = await request(`/images/${encodeURIComponent(selected.value.image_key)}/backups`)
    backups.value = data.data || []
  } catch (err) { error.value = err.message }
  finally { backupLoading.value = false }
}

async function saveDescription() {
  if (!selected.value || actionBusy.value) return
  actionBusy.value = true
  try {
    await request(`/images/${encodeURIComponent(selected.value.image_key)}`, { method: 'PATCH', body: { description: description.value } })
    selected.value.description = description.value
  } catch (err) { error.value = err.message }
  finally { actionBusy.value = false }
}

async function manualBackup() {
  if (!selected.value || actionBusy.value) return
  actionBusy.value = true
  try {
    await request(`/images/${encodeURIComponent(selected.value.image_key)}/backup`, { method: 'POST' })
    await loadBackups()
  } catch (err) { error.value = err.message }
  finally { actionBusy.value = false }
}

function download() {
  if (!selected.value) return
  const link = document.createElement('a')
  link.href = imageUrl(selected.value.image_key)
  link.download = selected.value.original_name || selected.value.image_key
  link.click()
}

function copyEmbed(type) {
  if (!selected.value) return
  const url = imageUrl(selected.value.image_key)
  const name = selected.value.original_name || selected.value.image_key
  copy(type === 'markdown' ? `![${name}](${url})` : `<img src="${url}" alt="${name}" />`)
}

function onKeydown(event) { if (event.key === 'Escape') closeModal() }

watch(() => props.query, () => load(1))
onMounted(() => { load(); document.addEventListener('keydown', onKeydown) })
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); document.body.style.overflow = '' })
</script>

<template>
  <section>
    <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-6">
      <div><span class="text-primary font-bold text-xs uppercase tracking-[0.2em] mb-2 block">资产仓库</span><h2 class="text-2xl sm:text-4xl font-extrabold text-on-surface">图床画廊</h2></div>
      <button class="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-surface-container-high self-start" @click="load(page)"><span class="material-symbols-outlined text-sm">refresh</span> 刷新</button>
    </div>
    <p v-if="error" role="alert" class="mb-5 p-3 bg-error/10 text-error rounded-lg text-sm">{{ error }}</p>
    <p v-if="loading" class="text-sm text-on-surface-variant">加载中...</p>
    <div v-else-if="images.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-8">
      <article v-for="image in images" :key="image.id" class="group relative bg-surface-container-low rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <button class="aspect-[4/3] w-full overflow-hidden relative block text-left" :aria-label="`查看 ${image.original_name || image.image_key}`" @click="openModal(image)">
          <img :src="imageUrl(image.image_key)" :alt="image.original_name || image.image_key" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          <span class="absolute bottom-3 right-3 px-2 py-1 bg-black/40 backdrop-blur rounded text-[10px] text-white font-mono uppercase">{{ image.mime_type?.split('/').pop() || 'IMG' }}</span>
        </button>
        <div class="p-4">
          <h3 class="font-bold text-on-surface truncate text-sm mb-1" :title="image.original_name">{{ image.original_name || image.image_key }}</h3>
          <p class="text-xs text-on-surface-variant truncate mb-3" :title="image.description || '暂无描述'">{{ image.description || '暂无描述' }}</p>
          <div class="flex items-center gap-2">
            <button class="flex-1 min-w-0 flex items-center justify-center gap-1 px-1 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[10px] font-bold whitespace-nowrap" @click="copy(imageUrl(image.image_key))"><span class="material-symbols-outlined text-xs">link</span> 复制链接</button>
            <button class="flex-1 min-w-0 flex items-center justify-center gap-1 px-1 py-1.5 bg-surface-container-high text-on-surface-variant rounded-lg text-[10px] font-bold whitespace-nowrap" @click="copy(`![${image.original_name}](${imageUrl(image.image_key)})`)"><span class="material-symbols-outlined text-xs">code</span> MD</button>
            <button class="p-1.5 hover:bg-error/10 text-error rounded-lg" title="删除图片" @click="remove(image)"><span class="material-symbols-outlined text-sm">delete</span></button>
          </div>
        </div>
      </article>
    </div>
    <p v-else class="text-center py-16 text-on-surface-variant">{{ query ? '没有找到匹配的图片' : '暂无图片' }}</p>
    <div class="mt-20 flex flex-col md:flex-row items-center justify-between border-t border-outline-variant/20 pt-10">
      <div class="flex items-center gap-8 mb-6 md:mb-0"><div class="flex flex-col"><span class="text-[10px] font-bold text-outline uppercase tracking-widest">体积统计</span><span class="text-lg font-extrabold mt-1">{{ (Number(stats.total_size || 0) / 1024 / 1024).toFixed(2) }} MB</span></div><div class="flex flex-col"><span class="text-[10px] font-bold text-outline uppercase tracking-widest">活跃资产</span><span class="text-lg font-extrabold mt-1">{{ stats.total_images || 0 }}</span></div></div>
      <nav class="flex flex-wrap items-center gap-2" aria-label="图库分页"><button v-for="number in pagination" :key="number" class="px-3 h-8 rounded-lg text-xs font-bold" :class="number === page ? 'bg-primary-container text-white' : 'hover:bg-surface-container-low'" @click="load(number)">{{ number }}</button></nav>
    </div>

    <div v-if="selected" class="fixed inset-0 z-[100]" role="dialog" aria-modal="true" :aria-label="selected.original_name || '图片详情'">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeModal"></div>
      <div class="absolute inset-2 lg:inset-10 bg-surface rounded-xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        <div class="h-[35vh] min-h-[200px] lg:h-auto lg:flex-1 lg:min-h-0 bg-surface-container-low flex items-center justify-center p-2 lg:p-8 relative group">
          <img :src="imageUrl(selected.image_key)" :alt="selected.original_name" class="max-w-full max-h-full object-contain rounded-lg" />
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><div class="bg-glass px-4 py-2 rounded-full flex gap-4 items-center shadow-lg"><button class="hover:text-primary flex items-center gap-1 text-xs font-bold uppercase" @click="download"><span class="material-symbols-outlined text-lg">download</span> 下载</button><span class="w-px h-4 bg-outline-variant/30"></span><a :href="imageUrl(selected.image_key)" target="_blank" rel="noopener" class="hover:text-primary flex items-center gap-1 text-xs font-bold uppercase"><span class="material-symbols-outlined text-lg">open_in_new</span> 新窗口</a></div></div>
          <button class="absolute top-4 left-4 p-2 bg-surface-container-highest/80 rounded-full" aria-label="关闭详情" @click="closeModal"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="flex-1 lg:w-96 bg-white flex flex-col overflow-hidden min-h-0"><div class="flex-1 overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-6">
          <div><span class="text-xs font-bold text-outline uppercase tracking-widest">文件信息</span><h2 class="text-lg lg:text-xl font-extrabold mt-1 break-all">{{ selected.original_name || selected.image_key }}</h2><div class="mt-2 lg:mt-3 flex gap-2"><textarea v-model="description" rows="2" placeholder="添加描述..." class="flex-1 bg-surface-container-highest border-none rounded-lg px-3 py-2 text-sm resize-none"></textarea><button :disabled="actionBusy" class="self-end px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-bold disabled:opacity-50" @click="saveDescription">保存</button></div></div>
          <div class="space-y-3"><h3 class="text-sm font-bold">集成链接</h3><div><label class="text-xs font-semibold text-outline">直链</label><div class="flex gap-2 mt-1"><input :value="imageUrl(selected.image_key)" readonly class="min-w-0 flex-1 bg-surface-container-highest rounded-lg px-3 py-2 text-xs font-mono truncate" /><button class="primary-gradient text-white px-3 py-2 rounded-lg" title="复制直链" @click="copy(imageUrl(selected.image_key))"><span class="material-symbols-outlined text-sm">content_copy</span></button></div></div><div class="grid grid-cols-2 gap-3"><button class="bg-surface-container-high px-3 py-2 rounded-lg text-xs font-bold" @click="copyEmbed('markdown')">复制 Markdown</button><button class="bg-surface-container-high px-3 py-2 rounded-lg text-xs font-bold" @click="copyEmbed('html')">复制 HTML</button></div></div>
          <div class="space-y-3"><h3 class="text-sm font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary">info</span> 技术参数</h3><div v-for="row in [{ label: '文件大小', value: selected.file_size ? `${(selected.file_size / 1024).toFixed(2)} KB` : '-' }, { label: '格式', value: selected.mime_type || '-' }, { label: '上传者', value: selected.uploader || '-' }, { label: '上传时间', value: selected.uploaded_at ? new Date(selected.uploaded_at).toLocaleString('zh-CN') : '-' }, { label: '存储路径', value: selected.mount_key || '-' }]" :key="row.label" class="flex justify-between items-center gap-3 py-2 border-b border-outline-variant/10"><span class="text-sm text-outline shrink-0">{{ row.label }}</span><span class="text-xs text-right break-all">{{ row.value }}</span></div></div>
          <div class="space-y-3"><h3 class="text-sm font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary">backup</span> 备份状态</h3><p v-if="backupLoading" class="text-xs text-on-surface-variant">加载中...</p><p v-else-if="!backups.length" class="text-xs text-on-surface-variant">暂无备份记录</p><div v-for="backup in backups" :key="backup.mount_key" class="flex items-center justify-between py-2 px-3 bg-surface-container-low rounded-lg"><div><p class="text-xs font-bold">{{ backup.mount_name || backup.mount_key }}</p><p class="text-[10px] text-on-surface-variant">{{ backup.provider_name }}</p></div><span class="text-[10px] px-2 py-0.5 rounded" :class="Number(backup.status) === 2 ? 'bg-green-100 text-green-700' : Number(backup.status) === 3 ? 'bg-error/20 text-error' : 'bg-surface-container-high text-on-surface-variant'">{{ Number(backup.status) === 2 ? '已备份' : Number(backup.status) === 3 ? '备份失败' : Number(backup.status) === 1 ? '备份中' : '待备份' }}</span></div><button :disabled="actionBusy" class="w-full py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50" @click="manualBackup"><span class="material-symbols-outlined text-sm">sync</span> 手动备份</button></div>
          <div class="bg-error-container/10 border-l-4 border-error rounded-r-lg p-3 lg:p-4 space-y-2"><p class="text-xs font-bold text-error uppercase tracking-widest">危险操作</p><p class="text-xs text-on-surface-variant">删除后无法恢复，所有外部链接将失效</p><button class="w-full py-2 bg-error text-white rounded-lg text-sm font-bold" @click="remove(selected)">删除图片</button></div>
        </div></div>
      </div>
    </div>
  </section>
</template>
