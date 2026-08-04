<script setup lang="ts">
definePageMeta({ auth: false })
useSeoMeta({ title: 'Log in — 3PL Market' })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()

const state = reactive({ email: '', password: '' })
const pending = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  pending.value = true
  try {
    const { user } = await $fetch('/api/auth/login', { method: 'POST', body: state })
    await refreshSession()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    await navigateTo(redirect && redirect.startsWith('/') ? redirect : roleHome(user.role))
  }
  catch (err) {
    error.value = apiErrorMessage(err)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto px-4 py-16">
    <UCard>
      <template #header>
        <h1 class="font-semibold text-highlighted text-lg">Log in</h1>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="email" placeholder="you@company.com" class="w-full" required />
        </UFormField>
        <UFormField label="Password" name="password" required>
          <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" required />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
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
