<script setup lang="ts">
import { LOAD_STATUSES } from '#shared/types'
import type { LoadStatus } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['shipper'] } })
useSeoMeta({ title: 'My loads — 3PL Market' })

const statusFilter = ref<LoadStatus | undefined>(undefined)
const { data, pending } = await useFetch('/api/loads', {
  query: computed(() => ({ status: statusFilter.value || undefined })),
})

const statusItems = [
  { label: 'All statuses', value: undefined },
  ...LOAD_STATUSES.map(s => ({ label: LOAD_STATUS_LABELS[s], value: s })),
]
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-highlighted">My loads</h1>
      <div class="flex items-center gap-3">
        <USelect v-model="statusFilter" :items="statusItems" placeholder="All statuses" class="w-40" />
        <UButton to="/shipper/loads/new" icon="i-lucide-plus">Post a load</UButton>
      </div>
    </div>

    <UCard v-if="!pending && !data?.loads?.length" class="text-center py-10">
      <UIcon name="i-lucide-package-open" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">No loads yet</p>
      <p class="text-sm text-muted">Post your first load to start getting bids from carriers.</p>
      <UButton to="/shipper/loads/new" class="mt-4" icon="i-lucide-plus">Post a load</UButton>
    </UCard>

    <div v-else class="space-y-3">
      <NuxtLink v-for="load in data?.loads" :key="load.id" :to="`/shipper/loads/${load.id}`" class="block group">
        <UCard class="transition-shadow group-hover:shadow-md">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="flex-1 min-w-48">
              <p class="font-medium text-highlighted">
                {{ load.pickupCity }}, {{ load.pickupState }}
                <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
                {{ load.deliveryCity }}, {{ load.deliveryState }}
              </p>
              <p class="text-sm text-muted mt-0.5">
                {{ MATERIAL_TYPE_LABELS[load.materialType] }} · {{ formatWeight(load.weightKg) }}
                · pickup {{ formatDate(load.pickupWindowStart) }}
              </p>
            </div>
            <UBadge v-if="load.status === 'posted' && load.pendingBidCount" color="info" variant="soft">
              {{ load.pendingBidCount }} bid{{ load.pendingBidCount === 1 ? '' : 's' }}
            </UBadge>
            <p class="font-semibold text-highlighted tabular-nums">
              {{ formatCents(load.finalPriceCents ?? load.askingPriceCents) }}
            </p>
            <LoadStatusBadge :status="load.status" />
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
