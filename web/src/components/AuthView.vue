<script setup>
import { ref, watch } from 'vue'
import { request } from '../api'

const props = defineProps({ mode: { type: String, required: true } })
const emit = defineEmits(['navigate'])
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptedTerms = ref(false)
const error = ref('')
const busy = ref(false)

watch(() => props.mode, () => {
  error.value = ''
  password.value = ''
  confirmPassword.value = ''
})

async function submit() {
  if (busy.value) return
  if (props.mode === 'register' && password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致！'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const data = await request(props.mode === 'register' ? '/auth/register' : '/auth/login', {
      method: 'POST', auth: false, body: { username: username.value.trim(), password: password.value }
    })
    if (props.mode === 'register') {
      emit('navigate', '/login')
      return
    }
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_info', JSON.stringify(data.user))
    emit('navigate', '/')
  } catch (err) {
    error.value = err.message || '网络错误，请稍后再试。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main v-if="mode === 'login'" class="min-h-screen flex items-center justify-center px-4 py-10 bg-surface">
    <div class="w-full max-w-sm">
      <div class="flex items-center justify-center gap-3 mb-6">
        <span class="w-10 h-10 primary-gradient rounded-lg flex items-center justify-center">
          <span class="material-symbols-outlined text-white text-xl">gallery_thumbnail</span>
        </span>
        <h1 class="font-headline text-xl font-bold text-on-surface">数字馆长</h1>
      </div>
      <div class="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-6 shadow-[0_8px_24px_rgba(25,28,30,0.05)]">
        <h2 class="font-headline text-lg font-bold mb-4">欢迎回来</h2>
        <form class="space-y-4" @submit.prevent="submit">
          <p v-if="error" role="alert" class="bg-error/10 text-error px-3 py-2 rounded-lg text-sm font-bold">{{ error }}</p>
          <div class="space-y-1.5">
            <label for="login-username" class="font-label text-xs font-bold text-on-surface-variant uppercase block">用户名或邮箱</label>
            <input id="login-username" v-model="username" required autocomplete="username" class="w-full bg-surface-container-highest border-none rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/40" placeholder="admin" type="text" />
          </div>
          <div class="space-y-1.5">
            <label for="login-password" class="font-label text-xs font-bold text-on-surface-variant uppercase block">密码</label>
            <input id="login-password" v-model="password" required autocomplete="current-password" class="w-full bg-surface-container-highest border-none rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/40" placeholder="••••••••" type="password" />
          </div>
          <button :disabled="busy" class="w-full primary-gradient text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50" type="submit">
            <span>{{ busy ? '登录中...' : '立即登录' }}</span><span class="material-symbols-outlined text-base">login</span>
          </button>
        </form>
        <div class="grid grid-cols-2 gap-2 mt-4">
          <button type="button" disabled title="尚未接入 SSO 登录" class="py-2 px-3 bg-surface-container-low rounded-lg text-xs font-semibold text-on-surface-variant">SSO 登录</button>
          <button type="button" disabled title="尚未接入 GitHub 登录" class="py-2 px-3 bg-surface-container-low rounded-lg text-xs font-semibold text-on-surface-variant"><span class="material-symbols-outlined text-base">terminal</span> GitHub</button>
        </div>
      </div>
      <p class="text-center mt-5 text-on-surface-variant text-sm">还没有账号？ <a href="/register" class="text-primary font-bold hover:underline" @click.prevent="emit('navigate', '/register')">立即注册</a></p>
    </div>
  </main>

  <main v-else class="min-h-screen flex items-center justify-center px-4 py-10 bg-surface">
    <div class="w-full max-w-md">
      <div class="flex items-center justify-center gap-3 mb-6">
        <span class="w-10 h-10 primary-gradient rounded-lg flex items-center justify-center">
          <span class="material-symbols-outlined text-white text-xl">gallery_thumbnail</span>
        </span>
        <h1 class="font-headline text-xl font-bold text-on-surface">数字馆长</h1>
      </div>
      <div class="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-6 shadow-[0_8px_24px_rgba(25,28,30,0.05)]">
        <h2 class="font-headline text-lg font-bold mb-4">创建新账户</h2>
        <form class="space-y-4" @submit.prevent="submit">
          <p v-if="error" role="alert" class="bg-error/10 text-error px-3 py-2 rounded-lg text-sm font-bold">{{ error }}</p>
          <div class="space-y-1.5">
            <label for="register-username" class="font-label text-xs font-bold uppercase text-on-surface-variant block">用户名</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">person</span>
              <input id="register-username" v-model="username" required minlength="3" maxlength="20" autocomplete="username" class="w-full pl-10 pr-3 py-2.5 bg-surface-container-highest rounded-lg border-none text-sm focus:ring-2 focus:ring-primary/40" placeholder="输入您的用户名" type="text" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label for="register-password" class="font-label text-xs font-bold uppercase text-on-surface-variant block">密码</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">lock</span>
              <input id="register-password" v-model="password" required autocomplete="new-password" class="w-full pl-10 pr-3 py-2.5 bg-surface-container-highest rounded-lg border-none text-sm focus:ring-2 focus:ring-primary/40" placeholder="••••••••" type="password" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label for="register-confirm" class="font-label text-xs font-bold uppercase text-on-surface-variant block">确认密码</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">verified_user</span>
              <input id="register-confirm" v-model="confirmPassword" required autocomplete="new-password" class="w-full pl-10 pr-3 py-2.5 bg-surface-container-highest rounded-lg border-none text-sm focus:ring-2 focus:ring-primary/40" placeholder="••••••••" type="password" />
            </div>
          </div>
          <label class="flex items-start gap-2.5 text-sm text-on-surface-variant">
            <input v-model="acceptedTerms" required type="checkbox" class="w-4 h-4 mt-0.5 text-primary rounded" />
            <span>我同意服务条款和隐私政策</span>
          </label>
          <button :disabled="busy" type="submit" class="w-full primary-gradient text-white font-headline font-bold py-2.5 rounded-lg disabled:opacity-50">{{ busy ? '正在注册...' : '立即注册' }}</button>
        </form>
        <p class="mt-4 text-center text-on-surface-variant text-sm">已经拥有账户？ <a href="/login" class="text-primary font-bold hover:underline" @click.prevent="emit('navigate', '/login')">登录控制台</a></p>
      </div>
    </div>
  </main>
</template>
