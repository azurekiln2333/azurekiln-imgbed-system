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
  <section class="space-y-4">
    <h2 class="text-2xl font-bold text-on-surface">上传中心</h2>
    <p v-if="error" role="alert" class="p-3 bg-error/10 text-error rounded-lg text-sm">{{ error }}</p>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div class="lg:col-span-7 space-y-4">
        <div class="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5">
          <div
            class="border-2 border-dashed border-outline-variant/60 rounded-lg px-4 py-8 sm:py-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors hover:border-primary/60 hover:bg-surface-container-low"
            @dragover.prevent
            @drop="onDrop"
            @click="fileInput.click()"
          >
            <input ref="fileInput" type="file" class="hidden" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp" multiple @click.stop @change="addFiles($event.target.files)" />
            <span class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3"><span class="material-symbols-outlined text-2xl text-primary">cloud_upload</span></span>
            <p class="text-base font-bold text-on-surface">将图片拖拽到此处</p>
            <p class="text-sm text-on-surface-variant mt-1 mb-4">点击或拖拽上传 JPG、PNG、WEBP、GIF、SVG，单张最大 50MB</p>
            <span class="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg">选择文件</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h3 class="text-base font-bold">上传队列 <span class="text-xs font-mono font-normal text-on-surface-variant">{{ queue.length }} 个文件</span></h3>
            <div class="flex items-center gap-2">
              <button type="button" :disabled="busy || !queue.length" class="px-3 py-1.5 text-xs font-bold text-on-surface-variant bg-surface-container-high rounded-lg disabled:opacity-50" @click="clearQueue">清空队列</button>
              <button type="button" :disabled="busy || !queue.length" class="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-lg disabled:opacity-50" @click="startUpload">{{ busy ? '上传中...' : '开始上传' }}</button>
            </div>
          </div>
          <div v-if="queue.length" class="space-y-2 max-h-96 overflow-y-auto">
            <div v-for="item in queue" :key="item.id" class="bg-surface-container-low rounded-lg p-2.5 flex items-center gap-3 min-w-0">
              <img :src="item.preview" alt="" class="w-10 h-10 rounded object-cover shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate" :title="item.file.name">{{ item.file.name }}</p>
                <p class="text-xs text-on-surface-variant">{{ (item.file.size / 1024).toFixed(1) }} KB · {{ item.status === 'pending' ? '等待上传' : item.status === 'uploading' ? `${item.progress}% ${item.speed}` : item.status === 'success' ? '上传成功' : item.error }}</p>
                <div v-if="item.status === 'uploading'" class="h-1 bg-surface-container-high mt-1.5 rounded"><div class="h-1 bg-primary rounded" :style="{ width: `${item.progress}%` }"></div></div>
              </div>
              <button type="button" :disabled="busy" class="text-outline hover:text-error disabled:opacity-40" title="移除文件" @click="removeItem(item)"><span class="material-symbols-outlined text-lg">close</span></button>
            </div>
          </div>
          <p v-else class="text-sm text-on-surface-variant py-4 text-center">拖拽或选择文件添加到队列</p>
        </div>
      </div>

      <div class="lg:col-span-5 space-y-4">
        <div class="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5 space-y-3">
          <h3 class="text-base font-bold">上传选项</h3>
          <div>
            <label for="upload-mount" class="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">选择挂载点</label>
            <select id="upload-mount" v-model="mountKey" :disabled="busy" class="w-full bg-surface-container-highest border-none rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/40">
              <option value="">暂无可用挂载点</option>
              <option v-for="mount in activeMounts" :key="mount.mount_key" :value="mount.mount_key">{{ mount.mount_name }} ({{ mount.provider_name }} - {{ Number(mount.is_public) === 1 ? '公共' : '私有' }})</option>
            </select>
          </div>
          <label class="flex items-start gap-2.5 p-3 bg-surface-container-low rounded-lg">
            <input v-model="isPrivate" :disabled="busy" type="checkbox" class="w-4 h-4 mt-0.5 rounded border-outline-variant" />
            <span><span class="block text-sm font-medium">存放在私有目录</span><span class="block text-xs text-on-surface-variant mt-0.5">勾选后图片将存入用户专属目录，否则存入公共目录</span></span>
          </label>
        </div>

        <div class="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5 space-y-3">
          <h3 class="text-base font-bold">自动提取链接</h3>
          <div v-for="entry in [{ label: 'Markdown', value: links?.markdown }, { label: 'HTML', value: links?.html }, { label: '直链', value: links?.direct }]" :key="entry.label">
            <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">{{ entry.label }}</label>
            <div class="flex gap-2">
              <input class="min-w-0 flex-1 bg-surface-container-high border-none text-xs font-mono rounded-lg py-2 px-3" readonly :value="entry.value || '请先上传图片...'" />
              <button type="button" class="shrink-0 bg-surface-container-high hover:bg-surface-container-highest px-2.5 rounded-lg" :title="`复制 ${entry.label}`" @click="copy(entry.value)"><span class="material-symbols-outlined text-base">content_copy</span></button>
            </div>
          </div>
          <div class="bg-surface-container-low rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            <img v-if="preview" :src="preview" alt="预览图" class="w-full h-full object-contain" />
            <span v-else class="text-outline text-sm">暂无上传图片</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
