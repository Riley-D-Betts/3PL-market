<script setup lang="ts">
import { LOAD_STATUSES } from '#shared/types'
import type { LoadStatus } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['superadmin'] } })
useSeoMeta({ title: 'Loads — 3PL Market' })

const statusFilter = ref<LoadStatus | undefined>(undefined)
const { data } = await useFetch('/api/admin/loads', {
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
      <h1 class="text-xl font-bold text-highlighted">All loads</h1>
      <USelect v-model="statusFilter" :items="statusItems" placeholder="All statuses" class="w-40" />
    </div>

    <div class="space-y-3">
      <UCard v-for="load in data?.loads" :key="load.id">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="flex-1 min-w-48">
            <p class="font-medium text-highlighted">
              <span class="text-muted font-normal tabular-nums mr-1">#{{ formatLoadNumber(load.loadNumber) }}</span>
              {{ load.pickupCity }}, {{ load.pickupState }}
              <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
              {{ load.deliveryCity }}, {{ load.deliveryState }}
            </p>
            <p class="text-sm text-muted mt-0.5">
              {{ load.shipperName ?? load.externalShipperName }}<span v-if="load.carrierName"> → {{ load.carrierName }}</span>
              · {{ MATERIAL_TYPE_LABELS[load.materialType] }} · {{ formatWeight(load.weightLbs) }}
              · {{ formatDate(load.createdAt) }}
            </p>
          </div>
          <p class="font-semibold text-highlighted tabular-nums">
            {{ formatCents(load.finalPriceCents ?? load.askingPriceCents) }}
          </p>
          <LoadStatusBadge :status="load.status" />
        </div>
      </UCard>
    </div>
  </div>
</template>
