<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { request } from '../api'

const tab = ref('providers')
const providers = ref([])
const mounts = ref([])
const error = ref('')
const busy = ref(false)
const selectedProvider = ref(null)
const selectedMount = ref(null)
const providerForm = reactive({ provider_name: '', api_host: '', api_token: '', alist_username: '', alist_password: '' })
const mountForm = reactive({ provider_id: '', mount_name: '', mount_path: '', is_backup: false, backup_for: '', is_public: false })
const mainMounts = computed(() => mounts.value.filter(m => Number(m.is_backup) !== 1))
let role = ''
try { role = JSON.parse(localStorage.getItem('user_info') || '{}').role || '' } catch { /* invalid cached profile */ }

async function loadAll() {
  error.value = ''
  try {
    const [providerData, mountData] = await Promise.all([request('/providers'), request('/mounts')])
    providers.value = providerData.data || []
    mounts.value = mountData.data || []
  } catch (err) { error.value = err.message }
}

function resetProvider() {
  selectedProvider.value = null
  Object.assign(providerForm, { provider_name: '', api_host: '', api_token: '', alist_username: '', alist_password: '' })
}

function editProvider(provider) {
  selectedProvider.value = provider
  Object.assign(providerForm, { provider_name: provider.provider_name, api_host: provider.api_host, api_token: '', alist_username: provider.alist_username || '', alist_password: '' })
}

async function saveProvider() {
  if (!providerForm.provider_name.trim() || !providerForm.api_host.trim()) { error.value = '请填写显示名称和 API 地址'; return }
  busy.value = true
  error.value = ''
  try {
    const payload = {
      provider_name: providerForm.provider_name.trim(), api_host: providerForm.api_host.trim(),
      alist_username: providerForm.alist_username.trim(),
      status: selectedProvider.value?.status ?? 1
    }
    if (!selectedProvider.value || providerForm.api_token) payload.api_token = providerForm.api_token
    if (!selectedProvider.value || providerForm.alist_password) payload.alist_password = providerForm.alist_password
    await request(selectedProvider.value ? `/providers/${selectedProvider.value.id}` : '/providers', { method: selectedProvider.value ? 'PUT' : 'POST', body: payload })
    resetProvider()
    await loadAll()
  } catch (err) { error.value = err.message }
  finally { busy.value = false }
}

async function deleteProvider() {
  if (!selectedProvider.value || !window.confirm('确定删除此存储节点吗？关联的挂载点也会被删除。')) return
  busy.value = true
  try {
    await request(`/providers/${selectedProvider.value.id}`, { method: 'DELETE' })
    resetProvider()
    await loadAll()
  } catch (err) { error.value = err.message }
  finally { busy.value = false }
}

function resetMount() {
  selectedMount.value = null
  Object.assign(mountForm, { provider_id: '', mount_name: '', mount_path: '', is_backup: false, backup_for: '', is_public: false })
}

function editMount(mount) {
  selectedMount.value = mount
  Object.assign(mountForm, {
    provider_id: String(mount.provider_id), mount_name: mount.mount_name,
    mount_path: mount.mount_path, is_backup: Number(mount.is_backup) === 1,
    backup_for: mount.backup_for || '', is_public: Number(mount.is_public) === 1
  })
}

async function saveMount() {
  if (!mountForm.provider_id || !mountForm.mount_name.trim()) { error.value = '请选择存储节点并填写挂载点名称'; return }
  if (mountForm.is_backup && !mountForm.backup_for) { error.value = '备份挂载点必须选择备份目标'; return }
  busy.value = true
  error.value = ''
  try {
    const payload = {
      provider_id: Number(mountForm.provider_id), mount_name: mountForm.mount_name.trim(),
      mount_path: mountForm.mount_path.trim() || '/', is_backup: mountForm.is_backup,
      backup_for: mountForm.is_backup ? mountForm.backup_for : null, is_public: mountForm.is_public,
      status: selectedMount.value?.status ?? 1
    }
    await request(selectedMount.value ? `/mounts/${selectedMount.value.id}` : '/mounts', { method: selectedMount.value ? 'PUT' : 'POST', body: payload })
    resetMount()
    await loadAll()
  } catch (err) { error.value = err.message }
  finally { busy.value = false }
}

async function deleteMount() {
  if (!selectedMount.value || !window.confirm('确定删除此挂载点吗？')) return
  busy.value = true
  try {
    await request(`/mounts/${selectedMount.value.id}`, { method: 'DELETE' })
    resetMount()
    await loadAll()
  } catch (err) { error.value = err.message }
  finally { busy.value = false }
}

onMounted(loadAll)
</script>

<template>
  <section>
    <div class="mb-8 sm:mb-12"><span class="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2 block">配置</span><h2 class="text-2xl sm:text-4xl font-extrabold text-on-surface mb-4">系统设置</h2><p class="text-on-surface-variant max-w-2xl leading-relaxed text-sm sm:text-base">管理存储节点和挂载点。存储节点是 AList 实例，挂载点是具体的存储路径。</p></div>
    <p v-if="error" role="alert" class="mb-5 p-3 bg-error/10 text-error rounded-lg text-sm">{{ error }}</p>
    <div class="flex gap-4 mb-8 border-b border-outline-variant/30" role="tablist">
      <button role="tab" :aria-selected="tab === 'providers'" class="px-4 py-3 text-sm font-bold border-b-2" :class="tab === 'providers' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'" @click="tab = 'providers'">存储节点</button>
      <button role="tab" :aria-selected="tab === 'mounts'" class="px-4 py-3 text-sm font-bold border-b-2" :class="tab === 'mounts' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'" @click="tab = 'mounts'">挂载点</button>
    </div>

    <div v-if="tab === 'providers'" class="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div class="lg:col-span-4 space-y-4">
        <div class="flex items-center justify-between mb-6"><span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">存储节点列表</span><button v-if="role === 'admin'" class="text-xs text-primary font-bold hover:underline" @click="resetProvider">+ 新建</button></div>
        <p v-if="!providers.length" class="text-sm text-on-surface-variant">暂无存储节点，请新建</p>
        <button v-for="provider in providers" :key="provider.id" class="w-full text-left group p-5 rounded-xl transition-all mb-3" :class="Number(provider.status) === 1 ? 'border-r-4 border-primary bg-white shadow-sm' : 'bg-surface-container-low opacity-70'" @click="editProvider(provider)">
          <span class="flex items-center gap-4"><span class="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-on-surface-variant shrink-0"><span class="material-symbols-outlined text-3xl">hard_drive</span></span><span class="min-w-0 flex-1"><span class="block font-bold truncate">{{ provider.provider_name }}</span><span class="block text-xs text-on-surface-variant truncate">{{ provider.provider_key }}</span></span><span v-if="Number(provider.status) === 1" class="material-symbols-outlined text-primary">check_circle</span></span>
        </button>
      </div>
      <div class="lg:col-span-8"><div class="bg-white rounded-xl p-4 sm:p-8 space-y-6 sm:space-y-10">
        <div class="flex items-center justify-between"><h3 class="text-xl font-bold">{{ selectedProvider ? `修改节点 ${selectedProvider.provider_name}` : '新建存储节点' }}</h3><button v-if="selectedProvider && role === 'admin'" class="text-xs text-error font-bold hover:underline" @click="deleteProvider">删除此节点</button></div>
        <form class="grid grid-cols-1 md:grid-cols-2 gap-6" @submit.prevent="saveProvider">
          <div class="space-y-2 md:col-span-2"><label for="provider-name" class="text-xs font-bold text-on-surface-variant uppercase ml-1">显示名称</label><input id="provider-name" v-model="providerForm.provider_name" :disabled="role !== 'admin'" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" placeholder="例如 主存储" required /></div>
          <div class="space-y-2 md:col-span-2"><label for="provider-host" class="text-xs font-bold text-on-surface-variant uppercase ml-1">API 地址</label><input id="provider-host" v-model="providerForm.api_host" :disabled="role !== 'admin'" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" placeholder="http://xxxx:5244" required /></div>
          <div class="space-y-2"><label for="provider-token" class="text-xs font-bold text-on-surface-variant uppercase ml-1">API Token</label><input id="provider-token" v-model="providerForm.api_token" :disabled="role !== 'admin'" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" :placeholder="selectedProvider ? '留空则保持现有 Token' : '与用户名密码二选一'" type="password" autocomplete="new-password" /></div>
          <div class="flex items-center gap-2 my-2"><span class="flex-1 h-px bg-outline-variant/30"></span><span class="text-xs text-on-surface-variant">或者</span><span class="flex-1 h-px bg-outline-variant/30"></span></div>
          <div class="space-y-2"><label for="provider-user" class="text-xs font-bold text-on-surface-variant uppercase ml-1">AList 用户名</label><input id="provider-user" v-model="providerForm.alist_username" :disabled="role !== 'admin'" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" placeholder="AList登录用户名" /></div>
          <div class="space-y-2"><label for="provider-password" class="text-xs font-bold text-on-surface-variant uppercase ml-1">AList 密码</label><input id="provider-password" v-model="providerForm.alist_password" :disabled="role !== 'admin'" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" :placeholder="selectedProvider ? '留空则保持现有密码' : 'AList登录密码'" type="password" autocomplete="new-password" /></div>
        </form>
        <div v-if="role === 'admin'" class="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4 border-t border-outline-variant/20"><button class="w-full sm:w-auto px-8 py-3 rounded-lg font-bold text-sm bg-surface-container-high" @click="resetProvider">清除</button><button :disabled="busy" class="w-full sm:w-auto px-10 py-3 rounded-lg primary-gradient text-white font-bold text-sm disabled:opacity-50" @click="saveProvider">保存节点</button></div>
      </div></div>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div class="lg:col-span-4 space-y-4"><div class="flex items-center justify-between mb-6"><span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">挂载点列表</span><button class="text-xs text-primary font-bold hover:underline" @click="resetMount">+ 新建</button></div><p v-if="!mounts.length" class="text-sm text-on-surface-variant">暂无挂载点，请新建</p>
        <button v-for="mount in mounts" :key="mount.id" class="w-full text-left group p-5 rounded-xl transition-all mb-3" :class="Number(mount.status) === 1 ? 'border-r-4 border-primary bg-white shadow-sm' : 'bg-surface-container-low opacity-70'" @click="editMount(mount)"><span class="flex items-center gap-4"><span class="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-on-surface-variant shrink-0"><span class="material-symbols-outlined text-3xl">folder</span></span><span class="min-w-0 flex-1"><span class="block font-bold truncate">{{ mount.mount_name }} <small v-if="Number(mount.is_backup) === 1" class="text-tertiary-container">备份</small><small class="ml-1 text-primary">{{ Number(mount.is_public) === 1 ? '公共' : '私有' }}</small></span><span class="block text-xs text-on-surface-variant truncate">{{ mount.provider_name }} - {{ mount.mount_path }}</span></span><span v-if="Number(mount.status) === 1" class="material-symbols-outlined text-primary">check_circle</span></span></button>
      </div>
      <div class="lg:col-span-8"><div class="bg-white rounded-xl p-4 sm:p-8 space-y-6 sm:space-y-10"><div class="flex items-center justify-between"><h3 class="text-xl font-bold">{{ selectedMount ? `修改挂载点 ${selectedMount.mount_name}` : '新建挂载点' }}</h3><button v-if="selectedMount" class="text-xs text-error font-bold hover:underline" @click="deleteMount">删除此挂载点</button></div>
        <form class="grid grid-cols-1 md:grid-cols-2 gap-6" @submit.prevent="saveMount">
          <div class="space-y-2"><label for="mount-provider" class="text-xs font-bold text-on-surface-variant uppercase ml-1">关联存储节点</label><select id="mount-provider" v-model="mountForm.provider_id" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" required><option value="">请选择存储节点</option><option v-for="provider in providers" :key="provider.id" :value="String(provider.id)">{{ provider.provider_name }} ({{ provider.provider_key }})</option></select></div>
          <div class="space-y-2"><label for="mount-name" class="text-xs font-bold text-on-surface-variant uppercase ml-1">显示名称</label><input id="mount-name" v-model="mountForm.mount_name" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" placeholder="例如 主存储路径" required /></div>
          <div class="space-y-2 md:col-span-2"><label for="mount-path" class="text-xs font-bold text-on-surface-variant uppercase ml-1">挂载路径</label><input id="mount-path" v-model="mountForm.mount_path" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" placeholder="/图片" /></div>
          <label class="flex items-center gap-3 text-sm"><input v-model="mountForm.is_backup" type="checkbox" class="w-5 h-5 rounded border-outline-variant" />设为备份存储（图片会同步到此路径）</label>
          <div v-if="mountForm.is_backup" class="space-y-2"><label for="mount-backup" class="text-xs font-bold text-on-surface-variant uppercase ml-1">备份目标挂载点</label><select id="mount-backup" v-model="mountForm.backup_for" class="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm" required><option value="">请选择要备份的挂载点</option><option v-for="mount in mainMounts" :key="mount.id" :value="mount.mount_key">{{ mount.mount_name }} ({{ mount.provider_name }})</option></select></div>
          <label class="flex items-center gap-3 text-sm"><input v-model="mountForm.is_public" type="checkbox" class="w-5 h-5 rounded border-outline-variant" :disabled="role !== 'admin'" />设为公共存储（所有用户可用）</label>
        </form>
        <div class="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4 border-t border-outline-variant/20"><button class="w-full sm:w-auto px-8 py-3 rounded-lg font-bold text-sm bg-surface-container-high" @click="resetMount">清除</button><button :disabled="busy" class="w-full sm:w-auto px-10 py-3 rounded-lg primary-gradient text-white font-bold text-sm disabled:opacity-50" @click="saveMount">保存挂载点</button></div>
      </div></div>
    </div>
  </section>
</template>
