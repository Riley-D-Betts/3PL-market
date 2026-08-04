<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Carrier dashboard — 3PL Market' })

const { data: me } = useNuxtData('auth-me')
const approved = computed(() => me.value?.company?.status === 'approved')

const { data: wonData } = await useFetch('/api/carrier/loads', {
  server: false,
  lazy: true,
  // Pending/suspended companies get a 403 — the banner explains why.
  ignoreResponseError: true,
})
const { data: bidData } = await useFetch('/api/bids', { server: false, lazy: true, ignoreResponseError: true })

const needsDriver = computed(() =>
  (wonData.value?.loads ?? []).filter(l => l.status === 'awarded' && !l.assignedDriverId))
const inTransit = computed(() =>
  (wonData.value?.loads ?? []).filter(l => ['awarded', 'picked_up'].includes(l.status) && l.assignedDriverId))
const activeBids = computed(() =>
  (bidData.value?.bids ?? []).filter(b => b.status === 'pending'))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-highlighted">Dispatch dashboard</h1>
      <UButton v-if="approved" to="/carrier/board" icon="i-lucide-search">Find loads</UButton>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <UCard>
        <p class="text-sm text-muted">Needs a driver</p>
        <p class="text-3xl font-bold text-highlighted mt-1">{{ needsDriver.length }}</p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">In progress</p>
        <p class="text-3xl font-bold text-highlighted mt-1">{{ inTransit.length }}</p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Open bids</p>
        <p class="text-3xl font-bold text-highlighted mt-1">{{ activeBids.length }}</p>
      </UCard>
    </div>

    <UCard v-if="needsDriver.length">
      <template #header>
        <h2 class="font-semibold text-highlighted">Awarded — assign a driver</h2>
      </template>
      <div class="space-y-2">
        <NuxtLink v-for="load in needsDriver" :key="load.id" :to="`/carrier/loads/${load.id}`" class="flex items-center justify-between gap-3 rounded-lg border border-default p-3 hover:bg-elevated transition-colors">
          <div>
            <p class="font-medium text-highlighted">{{ load.pickupCity }} → {{ load.deliveryCity }}</p>
            <p class="text-sm text-muted">pickup {{ formatDateTime(load.pickupWindowStart) }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-semibold tabular-nums">{{ formatCents(load.finalPriceCents) }}</span>
            <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
          </div>
        </NuxtLink>
      </div>
    </UCard>

    <UCard v-if="inTransit.length">
      <template #header>
        <h2 class="font-semibold text-highlighted">In progress</h2>
      </template>
      <div class="space-y-2">
        <NuxtLink v-for="load in inTransit" :key="load.id" :to="`/carrier/loads/${load.id}`" class="flex items-center justify-between gap-3 rounded-lg border border-default p-3 hover:bg-elevated transition-colors">
          <div>
            <p class="font-medium text-highlighted">{{ load.pickupCity }} → {{ load.deliveryCity }}</p>
            <p class="text-sm text-muted">{{ load.driverName }}<span v-if="load.vehiclePlate"> · {{ load.vehiclePlate }}</span></p>
          </div>
          <LoadStatusBadge :status="load.status" />
        </NuxtLink>
      </div>
    </UCard>
  </div>
</template>
