<script setup lang="ts">
import type { Role } from '#shared/types'

definePageMeta({ auth: false })
useSeoMeta({ title: 'Log in — 3PL Market' })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const demoMode = useRuntimeConfig().public.demoMode

const state = reactive({ email: '', password: '' })
const pending = ref(false)
const error = ref<string | null>(null)

async function finishLogin(role: Role) {
  await refreshSession()
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  await navigateTo(redirect && redirect.startsWith('/') ? redirect : roleHome(role))
}

async function submit() {
  error.value = null
  pending.value = true
  try {
    const { user } = await $fetch('/api/auth/login', { method: 'POST', body: state })
    await finishLogin(user.role)
  }
  catch (err) {
    error.value = apiErrorMessage(err)
  }
  finally {
    pending.value = false
  }
}

// ── Demo mode: one-click account picker ─────────────────────────────────────
const { data: demoData } = await useFetch('/api/auth/demo-accounts', {
  immediate: !!demoMode,
  ignoreResponseError: true,
})

const ROLE_GROUPS: { role: Role, label: string, icon: string }[] = [
  { role: 'shipper', label: 'Shippers', icon: 'i-lucide-package' },
  { role: 'carrier_admin', label: 'Carrier admins', icon: 'i-lucide-truck' },
  { role: 'driver', label: 'Drivers', icon: 'i-lucide-user' },
  { role: 'superadmin', label: 'Platform admin', icon: 'i-lucide-shield' },
]

const groupedAccounts = computed(() =>
  ROLE_GROUPS
    .map(group => ({
      ...group,
      accounts: (demoData.value?.accounts ?? []).filter(a => a.role === group.role),
    }))
    .filter(group => group.accounts.length))

const demoPendingId = ref<string | null>(null)

async function demoLogin(account: { id: string, role: Role }) {
  error.value = null
  demoPendingId.value = account.id
  try {
    const { user } = await $fetch('/api/auth/demo-login', { method: 'POST', body: { userId: account.id } })
    await finishLogin(user.role)
  }
  catch (err) {
    error.value = apiErrorMessage(err)
  }
  finally {
    demoPendingId.value = null
  }
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-16">
    <UCard>
      <template #header>
        <h1 class="font-semibold text-highlighted text-lg">Log in</h1>
        <p v-if="demoMode" class="text-sm text-muted mt-1">
          Demo mode — pick an account to explore that role, no password needed.
        </p>
      </template>

      <div v-if="demoMode && groupedAccounts.length" class="space-y-4">
        <div v-for="group in groupedAccounts" :key="group.role">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            <UIcon :name="group.icon" class="size-3.5 inline" /> {{ group.label }}
          </p>
          <div class="space-y-1.5">
            <button
              v-for="account in group.accounts"
              :key="account.id"
              type="button"
              class="w-full flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2 text-left transition-colors hover:bg-elevated hover:border-primary/50"
              :disabled="demoPendingId !== null"
              @click="demoLogin(account)"
            >
              <span class="min-w-0">
                <span class="block font-medium text-highlighted truncate">{{ account.name }}</span>
                <span class="block text-xs text-muted truncate">
                  {{ account.email }}<template v-if="account.companyName"> · {{ account.companyName }}</template>
                </span>
              </span>
              <UIcon
                :name="demoPendingId === account.id ? 'i-lucide-loader-circle' : 'i-lucide-arrow-right'"
                class="size-4 text-muted shrink-0"
                :class="demoPendingId === account.id ? 'animate-spin' : ''"
              />
            </button>
          </div>
        </div>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <USeparator label="or log in with credentials" />
      </div>

      <form class="space-y-4" :class="demoMode && groupedAccounts.length ? 'mt-4' : ''" @submit.prevent="submit">
        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="email" placeholder="you@company.com" class="w-full" required />
        </UFormField>
        <UFormField label="Password" name="password" required>
          <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" required />
        </UFormField>
        <UAlert v-if="error && !demoMode" color="error" variant="subtle" :description="error" />
        <UButton type="submit" block :loading="pending">Log in</UButton>
      </form>

      <template #footer>
        <p class="text-sm text-muted">
          No account yet?
          <NuxtLink to="/register" class="text-primary font-medium">Register</NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
