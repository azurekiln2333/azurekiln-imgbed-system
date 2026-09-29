<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { imageUrl, request } from '../api'

const queue = ref([])
const mounts = ref([])
const mountKey = ref('')
const isPrivate = ref(true)
const busy = ref(false)
const error = ref('')
const preview = ref('')
const links = ref(null)
const fileInput = ref(null)
let nextId = 0

const activeMounts = computed(() => mounts.value.filter(m => Number(m.status) === 1 && Number(m.is_backup) !== 1))

async function loadMounts() {
  try {
    const data = await request('/mounts')
    mounts.value = data.data || []
    if (!activeMounts.value.some(m => m.mount_key === mountKey.value)) mountKey.value = activeMounts.value[0]?.mount_key || ''
  } catch (err) { error.value = err.message }
}

function addFiles(files) {
  error.value = ''
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'].includes(file.type)) {
      error.value = '仅支持 JPG、PNG、WEBP、GIF、SVG、BMP 图片'
      continue
    }
    if (file.size > 50 * 1024 * 1024) {
      error.value = `${file.name} 超过 50MB 限制`
      continue
    }
    queue.value.push({ id: ++nextId, file, preview: URL.createObjectURL(file), status: 'pending', progress: 0, speed: '', error: '' })
  }
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(event) {
  event.preventDefault()
  addFiles(event.dataTransfer.files)
}

function removeItem(item) {
  if (busy.value) return
  URL.revokeObjectURL(item.preview)
  queue.value = queue.value.filter(entry => entry.id !== item.id)
}

function clearQueue() {
  if (busy.value) return
  queue.value.forEach(item => URL.revokeObjectURL(item.preview))
  queue.value = []
}

function uploadItem(item) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('image', item.file)
    form.append('mount_key', mountKey.value)
    form.append('is_private', isPrivate.value ? '1' : '0')
    let previousLoaded = 0
    let previousTime = Date.now()
    xhr.open('POST', '/api/upload')
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('auth_token') || ''}`)
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return
      item.progress = Math.round(event.loaded / event.total * 100)
      const now = Date.now()
      if (now - previousTime > 250) {
        item.speed = `${((event.loaded - previousLoaded) / (now - previousTime) * 1000 / 1024).toFixed(1)} KB/s`
        previousLoaded = event.loaded
        previousTime = now
      }
    }
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* invalid server response */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.image_key) resolve(data)
      else reject(new Error(data.error || `上传失败 (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('网络错误，上传失败'))
    xhr.send(form)
  })
}

async function startUpload() {
  if (busy.value || !queue.value.some(item => item.status === 'pending' || item.status === 'error')) return
  if (!mountKey.value) { error.value = '请先选择挂载点'; return }
  busy.value = true
  error.value = ''
  for (const item of queue.value) {
    if (item.status === 'success') continue
    item.status = 'uploading'
    item.error = ''
    try {
      const result = await uploadItem(item)
      item.status = 'success'
      item.progress = 100
      const url = imageUrl(result.image_key)
      links.value = {
        markdown: `![${item.file.name}](${url})`,
        html: `<img src="${url}" alt="${item.file.name}" />`,
        direct: result.direct_url || url
      }
      preview.value = item.preview
    } catch (err) {
      item.status = 'error'
      item.error = err.message
    }
  }
  busy.value = false
}

async function copy(text) {
  if (!text) return
  try { await navigator.clipboard.writeText(text) } catch { error.value = '复制失败，请手动复制链接' }
}

onMounted(loadMounts)
onUnmounted(() => queue.value.forEach(item => URL.revokeObjectURL(item.preview)))
</script>

<template>
  <section>
    <div class="mb-8 sm:mb-12">
      <span class="uppercase tracking-widest text-primary font-bold text-[0.6875rem] block mb-2">资产管理</span>
      <h2 class="text-2xl sm:text-4xl font-extrabold text-on-surface">上传中心</h2>
    </div>
    <p v-if="error" role="alert" class="mb-5 p-3 bg-error/10 text-error rounded-lg text-sm">{{ error }}</p>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
      <div class="lg:col-span-7 space-y-8">
        <div class="relative group cursor-pointer" @dragover.prevent @drop="onDrop" @click="fileInput.click()">
          <div class="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary-container/20 rounded-xl blur opacity-25 group-hover:opacity-75 transition"></div>
          <div class="relative bg-white border-2 border-dashed border-outline-variant/50 rounded-xl p-8 sm:p-16 flex flex-col items-center justify-center transition-all hover:bg-surface-container-low hover:border-primary/50">
            <input ref="fileInput" type="file" class="hidden" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp" multiple @click.stop @change="addFiles($event.target.files)" />
            <div class="w-20 h-20 bg-primary-fixed rounded-full flex items-center justify-center mb-6"><span class="material-symbols-outlined text-4xl text-primary">cloud_upload</span></div>
            <h3 class="text-xl sm:text-2xl font-bold mb-2 text-center">将图片拖拽到此处</h3>
            <p class="text-on-surface-variant text-sm text-center max-w-xs mb-8">点击或拖拽上传 JPG, PNG, WEBP, GIF, SVG 等。单张最大限制 50MB。</p>
            <button type="button" class="px-8 py-3 bg-primary text-white font-bold rounded-lg shadow-lg">选择文件</button>
          </div>
        </div>
        <div class="bg-surface-container-low rounded-xl p-4 sm:p-8">
          <h4 class="text-lg font-bold mb-6 flex items-center gap-2">上传队列 <span class="text-xs font-mono text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded">{{ queue.length }} 个文件</span></h4>
          <div v-if="queue.length" class="space-y-3 max-h-96 overflow-y-auto">
            <div v-for="item in queue" :key="item.id" class="bg-white rounded-lg p-3 flex items-center gap-3 min-w-0">
              <img :src="item.preview" alt="" class="w-12 h-12 rounded object-cover shrink-0" />
              <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate" :title="item.file.name">{{ item.file.name }}</p><p class="text-xs text-on-surface-variant">{{ (item.file.size / 1024).toFixed(1) }} KB · {{ item.status === 'pending' ? '等待上传' : item.status === 'uploading' ? `${item.progress}% ${item.speed}` : item.status === 'success' ? '上传成功' : item.error }}</p><div v-if="item.status === 'uploading'" class="h-1 bg-surface-container-high mt-2 rounded"><div class="h-1 bg-primary rounded" :style="{ width: `${item.progress}%` }"></div></div></div>
              <button type="button" :disabled="busy" class="text-outline hover:text-error disabled:opacity-40" title="移除文件" @click="removeItem(item)"><span class="material-symbols-outlined">close</span></button>
            </div>
          </div>
          <div v-else class="text-center py-8 text-on-surface-variant"><span class="material-symbols-outlined text-4xl mb-2">inbox</span><p class="text-sm">拖拽或选择文件添加到队列</p></div>
          <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-outline-variant/20">
            <button type="button" :disabled="busy || !queue.length" class="px-4 py-2 text-xs font-bold text-on-surface-variant bg-surface-container-high rounded-lg disabled:opacity-50" @click="clearQueue">清空队列</button>
            <button type="button" :disabled="busy || !queue.length" class="px-4 py-2 text-xs font-bold text-white bg-primary rounded-lg disabled:opacity-50" @click="startUpload">{{ busy ? '上传中...' : '开始上传' }}</button>
          </div>
        </div>
      </div>
      <div class="lg:col-span-5 space-y-8 lg:sticky top-24">
        <div class="bg-surface-container-low rounded-xl p-4 sm:p-6 space-y-4">
          <h4 class="text-lg font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary">tune</span> 上传选项</h4>
          <div><label for="upload-mount" class="block text-xs font-bold text-on-surface-variant uppercase mb-2">选择挂载点</label><select id="upload-mount" v-model="mountKey" :disabled="busy" class="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40"><option value="">暂无可用挂载点</option><option v-for="mount in activeMounts" :key="mount.mount_key" :value="mount.mount_key">{{ mount.mount_name }} ({{ mount.provider_name }} - {{ Number(mount.is_public) === 1 ? '公共' : '私有' }})</option></select></div>
          <label class="flex items-center gap-3 p-3 bg-surface-container-highest rounded-lg"><input v-model="isPrivate" :disabled="busy" type="checkbox" class="w-5 h-5 rounded border-outline-variant" /><span><span class="block text-sm font-medium">存放在私有目录</span><span class="block text-xs text-on-surface-variant mt-0.5">勾选后图片将存入用户专属目录，否则存入公共目录</span></span></label>
        </div>
        <div class="border border-white/20 p-4 sm:p-8 rounded-xl shadow-sm bg-white/40">
          <div class="flex items-center gap-3 mb-8"><span class="material-symbols-outlined text-primary">link</span><h4 class="text-xl font-extrabold">自动提取链接</h4></div>
          <div class="space-y-6">
            <div v-for="entry in [{ label: 'Markdown (论坛/GitHub)', value: links?.markdown }, { label: 'HTML Embed (网页)', value: links?.html }, { label: 'Direct URL (直链)', value: links?.direct }]" :key="entry.label">
              <label class="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">{{ entry.label }}</label>
              <div class="flex gap-2"><input class="min-w-0 flex-1 bg-surface-container-highest border-none text-xs font-mono rounded-lg py-3 px-4" readonly :value="entry.value || '请先上传图片...'" /><button type="button" class="bg-surface-container-high hover:bg-surface-container-highest p-3 rounded-lg" :title="`复制 ${entry.label}`" @click="copy(entry.value)"><span class="material-symbols-outlined text-sm">content_copy</span></button></div>
            </div>
          </div>
          <div class="bg-surface-container-low p-2 rounded-xl overflow-hidden aspect-video mt-8 flex items-center justify-center"><img v-if="preview" :src="preview" alt="预览图" class="w-full h-full object-contain rounded-xl" /><span v-else class="text-outline text-sm font-bold">暂无上传图片</span></div>
        </div>
      </div>
    </div>
  </section>
</template>
