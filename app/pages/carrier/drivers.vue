<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Drivers — 3PL Market' })

const toast = useToast()
const { data, refresh } = await useFetch('/api/fleet/drivers')

const showForm = ref(false)
const form = reactive({ name: '', email: '', phone: '', password: '', homeBaseCity: '', homeBaseState: '' })
const acting = ref(false)

async function createDriver() {
  acting.value = true
  try {
    await $fetch('/api/fleet/drivers', {
      method: 'POST',
      body: {
        ...form,
        phone: form.phone || undefined,
        homeBaseCity: form.homeBaseCity || undefined,
        homeBaseState: form.homeBaseState || undefined,
      },
    })
    Object.assign(form, { name: '', email: '', phone: '', password: '', homeBaseCity: '', homeBaseState: '' })
    showForm.value = false
    await refresh()
    toast.add({ title: 'Driver account created', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    acting.value = false
  }
}

async function toggleActive(driver: { id: string, isActive: boolean }) {
  try {
    await $fetch(`/api/fleet/drivers/${driver.id}`, {
      method: 'PATCH',
      body: { isActive: !driver.isActive },
    })
    await refresh()
    toast.add({ title: driver.isActive ? 'Driver deactivated' : 'Driver reactivated', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

async function resetPassword(driverId: string) {
  const password = window.prompt('New password for this driver (min. 8 characters):')
  if (!password) return
  try {
    await $fetch(`/api/fleet/drivers/${driverId}`, { method: 'PATCH', body: { password } })
    toast.add({ title: 'Password updated', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

async function editHomeBase(driver: { id: string, homeBaseCity: string | null, homeBaseState: string | null }) {
  const city = window.prompt('Home base city (empty to clear):', driver.homeBaseCity ?? '')
  if (city === null) return
  const state = city ? window.prompt('Home base state:', driver.homeBaseState ?? 'ID') : null
  if (city && state === null) return
  try {
    await $fetch(`/api/fleet/drivers/${driver.id}`, {
      method: 'PATCH',
      body: { homeBaseCity: city || null, homeBaseState: city ? (state || null) : null },
    })
    await refresh()
    toast.add({ title: city ? 'Home base updated' : 'Home base cleared', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-highlighted">Drivers</h1>
      <UButton icon="i-lucide-user-plus" @click="showForm = !showForm">Add driver</UButton>
    </div>

    <UCard v-if="showForm" class="mb-6">
      <template #header>
        <h2 class="font-semibold text-highlighted">Create driver account</h2>
        <p class="text-sm text-muted mt-1">The driver logs in with this email and password to see and update their assigned loads.</p>
      </template>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="createDriver">
        <UFormField label="Name" required>
          <UInput v-model="form.name" class="w-full" required />
        </UFormField>
        <UFormField label="Phone">
          <UInput v-model="form.phone" type="tel" class="w-full" />
        </UFormField>
        <UFormField label="Email" required>
          <UInput v-model="form.email" type="email" class="w-full" required />
        </UFormField>
        <UFormField label="Initial password" required hint="Min. 8 characters">
          <UInput v-model="form.password" type="text" minlength="8" class="w-full" required />
        </UFormField>
        <UFormField label="Home base city" hint="Shown on dispatch maps">
          <UInput v-model="form.homeBaseCity" placeholder="Boise" class="w-full" />
        </UFormField>
        <UFormField label="Home base state">
          <UInput v-model="form.homeBaseState" placeholder="ID" class="w-full" />
        </UFormField>
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" :loading="acting">Create driver</UButton>
          <UButton variant="ghost" color="neutral" @click="showForm = false">Cancel</UButton>
        </div>
      </form>
    </UCard>

    <UCard v-if="!data?.drivers?.length" class="text-center py-10">
      <UIcon name="i-lucide-users" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">No drivers yet</p>
      <p class="text-sm text-muted">Create driver accounts to dispatch your won loads.</p>
    </UCard>

    <div v-else class="space-y-3">
      <UCard v-for="driver in data?.drivers" :key="driver.id">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="flex-1 min-w-48">
            <p class="font-medium text-highlighted">{{ driver.name }}</p>
            <p class="text-sm text-muted mt-0.5">{{ driver.email }}<span v-if="driver.phone"> · {{ driver.phone }}</span></p>
            <p v-if="driver.homeBaseCity" class="text-sm text-muted mt-0.5">
              <UIcon name="i-lucide-house" class="size-3.5 inline" />
              {{ driver.homeBaseCity }}<span v-if="driver.homeBaseState">, {{ driver.homeBaseState }}</span>
            </p>
          </div>
          <UBadge :color="driver.isActive ? 'success' : 'neutral'" variant="subtle">
            {{ driver.isActive ? 'active' : 'inactive' }}
          </UBadge>
          <div class="flex gap-1">
            <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-house" title="Set home base" @click="editHomeBase(driver)" />
            <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-key-round" title="Reset password" @click="resetPassword(driver.id)" />
            <UButton
              size="sm"
              variant="ghost"
              :color="driver.isActive ? 'error' : 'success'"
              :icon="driver.isActive ? 'i-lucide-user-x' : 'i-lucide-user-check'"
              :title="driver.isActive ? 'Deactivate' : 'Reactivate'"
              @click="toggleActive(driver)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
