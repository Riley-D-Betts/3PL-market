<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['superadmin'] } })
useSeoMeta({ title: 'Platform overview — 3PL Market' })

const { data: companyData } = await useFetch('/api/admin/companies')
const { data: userData } = await useFetch('/api/admin/users')
const { data: loadData } = await useFetch('/api/admin/loads')

const pendingCompanies = computed(() => (companyData.value?.companies ?? []).filter(c => c.status === 'pending'))
const openLoads = computed(() => (loadData.value?.loads ?? []).filter(l => l.status === 'posted'))
const activeLoads = computed(() => (loadData.value?.loads ?? []).filter(l => ['awarded', 'picked_up', 'delivered'].includes(l.status)))
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold text-highlighted">Platform overview</h1>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard>
        <p class="text-sm text-muted">Carrier companies</p>
        <p class="text-3xl font-bold text-highlighted mt-1">{{ companyData?.companies?.length ?? 0 }}</p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Users</p>
        <p class="text-3xl font-bold text-highlighted mt-1">{{ userData?.users?.length ?? 0 }}</p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Open loads</p>
        <p class="text-3xl font-bold text-highlighted mt-1">{{ openLoads.length }}</p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Loads in progress</p>
        <p class="text-3xl font-bold text-highlighted mt-1">{{ activeLoads.length }}</p>
      </UCard>
    </div>

    <UCard v-if="pendingCompanies.length">
      <template #header>
        <h2 class="font-semibold text-highlighted">Awaiting approval</h2>
      </template>
      <div class="space-y-2">
        <div v-for="company in pendingCompanies" :key="company.id" class="flex items-center justify-between gap-3 rounded-lg border border-default p-3">
          <div>
            <p class="font-medium text-highlighted">{{ company.name }}</p>
            <p class="text-sm text-muted">{{ company.contactEmail }}</p>
          </div>
          <UButton to="/admin/companies" size="sm" variant="soft">Review</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
