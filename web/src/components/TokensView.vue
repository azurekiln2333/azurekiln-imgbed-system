<script setup>
import { onMounted, ref } from 'vue'
import { request } from '../api'

const tokens = ref([])
const name = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)
const loading = ref(false)
const createdToken = ref('')
const copied = ref(false)

async function loadTokens() {
  loading.value = true
  error.value = ''
  try {
    const data = await request('/tokens')
    tokens.value = data.data || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createToken() {
  const value = name.value.trim()
  if (!value) { error.value = '请先填写令牌名称'; return }
  busy.value = true
  error.value = ''
  notice.value = ''
  copied.value = false
  try {
    const data = await request('/tokens', { method: 'POST', body: { name: value } })
    createdToken.value = data.token
    name.value = ''
    await loadTokens()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function toggleToken(token) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await request(`/tokens/${token.id}`, { method: 'PUT', body: { status: Number(token.status) === 1 ? 0 : 1 } })
    await loadTokens()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function removeToken(token) {
  if (!window.confirm(`确定删除令牌「${token.name}」吗？使用该令牌的客户端将立即失效。`)) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await request(`/tokens/${token.id}`, { method: 'DELETE' })
    createdToken.value = ''
    await loadTokens()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function copyToken() {
  if (!createdToken.value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(createdToken.value)
    } else {
      const field = document.createElement('textarea')
      field.value = createdToken.value
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      document.execCommand('copy')
      document.body.removeChild(field)
    }
    copied.value = true
    notice.value = '令牌已复制到剪贴板'
  } catch {
    error.value = '复制失败，请手动选择令牌文本复制'
  }
}

function formatDate(value) {
  if (!value) return '从未使用'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', { hour12: false })
}

onMounted(loadTokens)
</script>

<template>
  <section>
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-on-surface">令牌管理</h2>
      <p class="mt-2 text-sm text-on-surface-variant max-w-2xl">为脚本或第三方工具创建 API 令牌，上传接口使用 <code class="px-1.5 py-0.5 rounded bg-surface-container-high text-xs">Authorization: Bearer &lt;token&gt;</code> 调用。令牌明文仅在创建时显示一次。</p>
    </div>

    <p v-if="error" role="alert" class="mb-5 p-3 bg-error/10 text-error rounded-lg text-sm">{{ error }}</p>
    <p v-if="notice" role="status" class="mb-5 p-3 bg-primary/10 text-primary rounded-lg text-sm">{{ notice }}</p>

    <div class="bg-white border border-outline-variant/40 rounded-lg p-4 sm:p-5 mb-4">
      <form class="flex flex-col sm:flex-row gap-3" @submit.prevent="createToken">
        <label class="sr-only" for="token-name">令牌名称</label>
        <input id="token-name" v-model="name" maxlength="50" placeholder="令牌名称，例如 CI 上传" class="flex-1 bg-surface-container-high border-none rounded-lg px-4 py-2.5 text-sm" />
        <button type="submit" :disabled="busy" class="px-6 py-2.5 rounded-lg primary-gradient text-white font-bold text-sm disabled:opacity-50">创建令牌</button>
      </form>

      <div v-if="createdToken" class="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p class="text-xs font-bold text-primary mb-2">新令牌（仅显示这一次，请立即保存）</p>
        <div class="flex flex-col sm:flex-row gap-2">
          <input :value="createdToken" readonly aria-label="新建的令牌" class="flex-1 bg-white rounded-lg px-3 py-2 text-sm font-mono break-all" @focus="$event.target.select()" />
          <button type="button" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold shrink-0" @click="copyToken">{{ copied ? '已复制' : '复制' }}</button>
        </div>
      </div>
    </div>

    <div class="bg-white border border-outline-variant/40 rounded-lg overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">已创建的令牌</span>
        <span class="text-xs text-on-surface-variant">{{ tokens.length }} 个</span>
      </div>

      <p v-if="loading" class="px-5 sm:px-6 py-8 text-sm text-on-surface-variant">加载中…</p>
      <p v-else-if="!tokens.length" class="px-5 sm:px-6 py-8 text-sm text-on-surface-variant">还没有令牌，创建一个即可用脚本上传图片。</p>

      <ul v-else class="divide-y divide-outline-variant/20">
        <li v-for="token in tokens" :key="token.id" class="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold truncate">{{ token.name }}</span>
              <span class="text-[11px] px-2 py-0.5 rounded shrink-0" :class="Number(token.status) === 1 ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'">{{ Number(token.status) === 1 ? '启用' : '停用' }}</span>
            </div>
            <p class="mt-1 text-xs text-on-surface-variant font-mono truncate">{{ token.token_prefix }}••••••••</p>
            <p class="mt-1 text-xs text-on-surface-variant">创建于 {{ formatDate(token.created_at) }} · 最近使用 {{ formatDate(token.last_used_at) }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" :disabled="busy" class="px-3 py-2 rounded-lg text-xs font-bold bg-surface-container-high disabled:opacity-50" @click="toggleToken(token)">{{ Number(token.status) === 1 ? '停用' : '启用' }}</button>
            <button type="button" :disabled="busy" class="px-3 py-2 rounded-lg text-xs font-bold text-error bg-error/10 disabled:opacity-50" @click="removeToken(token)">删除</button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
