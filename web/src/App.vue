<script setup>
import { computed, ref } from 'vue'
import AuthView from './components/AuthView.vue'
import DashboardView from './components/DashboardView.vue'

const pathname = ref(window.location.pathname)
const page = computed(() => pathname.value === '/register' ? 'register' : pathname.value === '/login' ? 'login' : 'dashboard')

function navigate(path) {
  window.history.pushState({}, '', path)
  pathname.value = path
}

window.addEventListener('popstate', () => { pathname.value = window.location.pathname })

if (page.value === 'dashboard' && !localStorage.getItem('auth_token')) navigate('/login')
</script>

<template>
  <AuthView v-if="page !== 'dashboard'" :mode="page" @navigate="navigate" />
  <DashboardView v-else @navigate="navigate" />
</template>
