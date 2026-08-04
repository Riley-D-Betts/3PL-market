<script setup lang="ts">
import { MATERIAL_TYPES } from '#shared/types'
import type { MaterialType } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Load board — 3PL Market' })

const filters = reactive({
  materialType: undefined as MaterialType | undefined,
  q: '',
  pickupState: '',
})

const query = computed(() => ({
  materialType: filters.materialType || undefined,
  q: filters.q || undefined,
  pickupState: filters.pickupState || undefined,
}))

const { data, pending, error } = await useFetch('/api/board', { query })

const materialItems = [
  { label: 'All materials', value: undefined },
  ...MATERIAL_TYPES.map(m => ({ label: MATERIAL_TYPE_LABELS[m], value: m })),
]
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-highlighted">Load board</h1>
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="filters.q" placeholder="Search city…" icon="i-lucide-search" class="w-44" />
        <UInput v-model="filters.pickupState" placeholder="Pickup state" class="w-32" />
        <USelect v-model="filters.materialType" :items="materialItems" placeholder="All materials" class="w-44" />
      </div>
    </div>

    <UAlert v-if="error" color="warning" variant="subtle" :description="apiErrorMessage(error)" />

    <UCard v-else-if="!pending && !data?.loads?.length" class="text-center py-10">
      <UIcon name="i-lucide-search-x" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">No open loads match</p>
      <p class="text-sm text-muted">Try clearing filters, or check back soon.</p>
    </UCard>

    <div v-else class="space-y-3">
      <NuxtLink v-for="load in data?.loads" :key="load.id" :to="`/carrier/board/${load.id}`" class="block group">
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
                · pickup {{ formatDate(load.pickupWindowStart) }} · {{ load.shipperName }}
              </p>
            </div>
            <UBadge v-if="load.myBid" color="info" variant="soft">
              Your bid: {{ formatCents(load.myBid.amountCents) }}
            </UBadge>
            <p class="font-semibold text-highlighted tabular-nums">{{ formatCents(load.askingPriceCents) }}</p>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
