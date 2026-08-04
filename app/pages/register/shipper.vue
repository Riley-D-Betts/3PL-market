<script setup lang="ts">
definePageMeta({ auth: false })
useSeoMeta({ title: 'Register as a shipper — 3PL Market' })

const { fetch: refreshSession } = useUserSession()

const state = reactive({ name: '', email: '', phone: '', password: '', billingEmail: '' })
const pending = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  pending.value = true
  try {
    await $fetch('/api/auth/register-shipper', {
      method: 'POST',
      body: {
        ...state,
        phone: state.phone || undefined,
        billingEmail: state.billingEmail || undefined,
      },
    })
    await refreshSession()
    await navigateTo('/shipper')
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
        <h1 class="font-semibold text-highlighted text-lg">Register as a shipper</h1>
        <p class="text-sm text-muted mt-1">Post loads and get bids from vetted carriers.</p>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Your name or company" name="name" required>
          <UInput v-model="state.name" class="w-full" required />
        </UFormField>
        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" required />
        </UFormField>
        <UFormField label="Phone" name="phone">
          <UInput v-model="state.phone" type="tel" class="w-full" />
        </UFormField>
        <UFormField label="Invoicing email" name="billingEmail" hint="Where carriers send invoices — defaults to your account email">
          <UInput v-model="state.billingEmail" type="email" class="w-full" />
        </UFormField>
        <UFormField label="Password" name="password" required hint="Min. 8 characters">
          <UInput v-model="state.password" type="password" autocomplete="new-password" minlength="8" class="w-full" required />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <UButton type="submit" block :loading="pending">Create account</UButton>
      </form>
      <template #footer>
        <p class="text-sm text-muted">
          Run a trucking company?
          <NuxtLink to="/register/carrier" class="text-primary font-medium">Register as a carrier</NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
