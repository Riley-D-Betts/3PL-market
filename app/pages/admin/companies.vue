<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['superadmin'] } })
useSeoMeta({ title: 'Companies — 3PL Market' })

const toast = useToast()
const { data, refresh } = await useFetch('/api/admin/companies')

const STATUS_COLORS: Record<string, 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  suspended: 'error',
}

async function approve(id: string) {
  try {
    await $fetch(`/api/admin/companies/${id}/approve`, { method: 'POST' })
    await refresh()
    toast.add({ title: 'Company approved', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

async function suspend(id: string) {
  const reason = window.prompt('Reason for suspension (optional):') ?? undefined
  try {
    await $fetch(`/api/admin/companies/${id}/suspend`, { method: 'POST', body: { reason: reason || undefined } })
    await refresh()
    toast.add({ title: 'Company suspended', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-highlighted mb-6">Carrier companies</h1>
    <div class="space-y-3">
      <UCard v-for="company in data?.companies" :key="company.id">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="flex-1 min-w-48">
            <p class="font-medium text-highlighted">{{ company.name }}</p>
            <p class="text-sm text-muted mt-0.5">
              {{ company.contactEmail }}
              <span v-if="company.mcNumber"> · {{ company.mcNumber }}</span>
              · {{ company.userCount }} user{{ company.userCount === 1 ? '' : 's' }}
              · {{ company.vehicleCount }} vehicle{{ company.vehicleCount === 1 ? '' : 's' }}
            </p>
            <p v-if="company.status === 'suspended' && company.suspendedReason" class="text-sm text-error mt-0.5">
              {{ company.suspendedReason }}
            </p>
          </div>
          <UBadge :color="STATUS_COLORS[company.status]" variant="subtle">{{ company.status }}</UBadge>
          <div class="flex gap-2">
            <UButton
              v-if="company.status !== 'approved'"
              size="sm"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              @click="approve(company.id)"
            >
              Approve
            </UButton>
            <UButton
              v-if="company.status !== 'suspended'"
              size="sm"
              color="error"
              variant="soft"
              icon="i-lucide-ban"
              @click="suspend(company.id)"
            >
              Suspend
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
