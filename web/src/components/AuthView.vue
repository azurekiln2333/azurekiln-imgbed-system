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
  <main v-if="mode === 'login'" class="min-h-screen flex items-center justify-center px-6 py-12 bg-surface">
    <div class="w-full max-w-md">
      <div class="flex flex-col items-center mb-10">
        <div class="w-12 h-12 primary-gradient rounded-xl mb-4 flex items-center justify-center shadow-lg shadow-primary/20">
          <span class="material-symbols-outlined text-white text-2xl">gallery_thumbnail</span>
        </div>
        <h1 class="font-headline text-3xl font-extrabold text-on-surface">数字馆长</h1>
        <p class="font-label text-sm uppercase tracking-widest text-outline mt-2">Digital Curator</p>
      </div>
      <div class="bg-white rounded-xl p-8 shadow-[0_12px_40px_rgba(25,28,30,0.06)]">
        <h2 class="font-headline text-xl font-bold mb-6">欢迎回来</h2>
        <form class="space-y-5" @submit.prevent="submit">
          <p v-if="error" role="alert" class="bg-error/10 text-error px-4 py-3 rounded-lg text-sm font-bold">{{ error }}</p>
          <div class="space-y-2">
            <label for="login-username" class="font-label text-xs font-bold text-outline uppercase tracking-wider block ml-1">用户名或邮箱</label>
            <input id="login-username" v-model="username" required autocomplete="username" class="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40" placeholder="admin" type="text" />
          </div>
          <div class="space-y-2">
            <label for="login-password" class="font-label text-xs font-bold text-outline uppercase tracking-wider block ml-1">密码</label>
            <input id="login-password" v-model="password" required autocomplete="current-password" class="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40" placeholder="••••••••" type="password" />
          </div>
          <button :disabled="busy" class="w-full primary-gradient text-white font-bold py-3.5 rounded-lg shadow-md flex items-center justify-center gap-2 mt-4 disabled:opacity-50" type="submit">
            <span>{{ busy ? '登录中...' : '立即登录' }}</span><span class="material-symbols-outlined text-lg">login</span>
          </button>
        </form>
        <div class="relative my-8"><div class="absolute inset-0 flex items-center"><div class="w-full border-t border-surface-container-highest"></div></div><div class="relative flex justify-center text-xs uppercase"><span class="bg-white px-4 text-outline font-medium">或者通过以下方式</span></div></div>
        <div class="grid grid-cols-2 gap-4">
          <button type="button" disabled title="尚未接入 SSO 登录" class="flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-low rounded-lg text-sm font-semibold text-on-surface-variant">SSO 登录</button>
          <button type="button" disabled title="尚未接入 GitHub 登录" class="flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-low rounded-lg text-sm font-semibold text-on-surface-variant"><span class="material-symbols-outlined text-xl">terminal</span> GitHub</button>
        </div>
      </div>
      <p class="text-center mt-8 text-on-surface-variant text-sm">还没有账号？ <a href="/register" class="text-primary font-bold hover:underline ml-1" @click.prevent="emit('navigate', '/register')">立即注册</a></p>
    </div>
  </main>

  <main v-else class="min-h-screen flex items-center justify-center p-6 bg-surface">
    <div class="w-full max-w-lg">
      <div class="text-center mb-10">
        <h1 class="font-headline font-extrabold text-4xl text-primary mb-2">数字馆长</h1>
        <p class="font-label text-sm uppercase tracking-widest text-outline">Digital Curator</p>
      </div>
      <div class="bg-white rounded-xl p-8 md:p-12 shadow-[0_12px_40px_rgba(25,28,30,0.06)]">
        <div class="mb-10">
          <h2 class="font-headline font-bold text-2xl">创建新账户</h2>
          <p class="text-on-surface-variant mt-2 font-medium">开始您的数字化资产管理之旅</p>
        </div>
        <form class="space-y-6" @submit.prevent="submit">
          <p v-if="error" role="alert" class="bg-error/10 text-error px-4 py-3 rounded-lg text-sm font-bold">{{ error }}</p>
          <div class="space-y-2">
            <label for="register-username" class="font-label text-xs font-bold uppercase tracking-wider text-outline px-1">用户名</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">person</span>
              <input id="register-username" v-model="username" required minlength="3" maxlength="20" autocomplete="username" class="w-full pl-12 pr-4 py-3.5 bg-surface-container-highest rounded-lg border-none focus:ring-2 focus:ring-primary/40" placeholder="输入您的用户名" type="text" />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label for="register-password" class="font-label text-xs font-bold uppercase tracking-wider text-outline px-1">密码</label>
              <div class="relative"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span><input id="register-password" v-model="password" required autocomplete="new-password" class="w-full pl-12 pr-4 py-3.5 bg-surface-container-highest rounded-lg border-none focus:ring-2 focus:ring-primary/40" placeholder="••••••••" type="password" /></div>
            </div>
            <div class="space-y-2">
              <label for="register-confirm" class="font-label text-xs font-bold uppercase tracking-wider text-outline px-1">确认密码</label>
              <div class="relative"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">verified_user</span><input id="register-confirm" v-model="confirmPassword" required autocomplete="new-password" class="w-full pl-12 pr-4 py-3.5 bg-surface-container-highest rounded-lg border-none focus:ring-2 focus:ring-primary/40" placeholder="••••••••" type="password" /></div>
            </div>
          </div>
          <label class="flex items-start gap-3 text-sm text-on-surface-variant font-medium">
            <input v-model="acceptedTerms" required type="checkbox" class="w-4 h-4 mt-0.5 text-primary rounded" />
            <span>我同意服务条款和隐私政策</span>
          </label>
          <button :disabled="busy" type="submit" class="w-full primary-gradient text-white font-headline font-bold py-4 rounded-lg shadow-lg shadow-primary/20 disabled:opacity-50">{{ busy ? '正在注册...' : '立即注册' }}</button>
        </form>
        <div class="mt-8 text-center pt-8 border-t border-surface-container-highest border-dashed">
          <p class="text-on-surface-variant font-medium">已经拥有账户？ <a href="/login" class="text-primary font-bold hover:underline ml-1" @click.prevent="emit('navigate', '/login')">登录控制台</a></p>
        </div>
      </div>
      <div class="mt-12 flex justify-center space-x-6"><span class="flex items-center space-x-2"><span class="material-symbols-outlined text-outline text-lg">shield</span><span class="font-label text-xs uppercase tracking-widest text-outline">高强度加密</span></span><span class="flex items-center space-x-2"><span class="material-symbols-outlined text-outline text-lg">cloud_done</span><span class="font-label text-xs uppercase tracking-widest text-outline">全球分发</span></span></div>
    </div>
  </main>
</template>
