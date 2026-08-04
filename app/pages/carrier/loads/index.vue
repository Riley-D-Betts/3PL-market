<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Won loads — 3PL Market' })

const { data, pending, error } = await useFetch('/api/carrier/loads')

const filter = ref<'all' | 'to_invoice' | 'invoiced'>('all')
const filterItems = [
  { label: 'All', value: 'all' },
  { label: 'Needs invoice', value: 'to_invoice' },
  { label: 'Invoiced', value: 'invoiced' },
]

// A load with no price and no detention has nothing to bill — internal
// yard moves shouldn't nag for an invoice.
function billable(l: { finalPriceCents: number | null, askingPriceCents: number | null, pickupDetentionCents: number | null, deliveryDetentionCents: number | null }): boolean {
  return (l.finalPriceCents ?? l.askingPriceCents) != null
    || !!l.pickupDetentionCents || !!l.deliveryDetentionCents
}

const filtered = computed(() => {
  const rows = data.value?.loads ?? []
  if (filter.value === 'to_invoice') {
    return rows.filter(l => ['delivered', 'completed'].includes(l.status) && !l.invoicedAt && billable(l))
  }
  if (filter.value === 'invoiced') return rows.filter(l => l.invoicedAt)
  return rows
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-highlighted">Won loads</h1>
      <div class="flex gap-2">
        <USelect v-model="filter" :items="filterItems" class="w-40" />
        <UButton to="/carrier/loads/new" variant="outline" icon="i-lucide-plus">Add external load</UButton>
      </div>
    </div>

    <UAlert v-if="error" color="warning" variant="subtle" :description="apiErrorMessage(error)" />

    <UCard v-else-if="!pending && !data?.loads?.length" class="text-center py-10">
      <UIcon name="i-lucide-trophy" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">No won loads yet</p>
      <p class="text-sm text-muted">Accept or win a bid on the load board and it will show up here.</p>
      <UButton to="/carrier/board" class="mt-4" icon="i-lucide-search">Browse the board</UButton>
    </UCard>

    <UCard v-else-if="!pending && !filtered.length" class="text-center py-10">
      <UIcon name="i-lucide-receipt" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">
        {{ filter === 'to_invoice' ? 'Nothing waiting to be invoiced' : 'No invoiced loads yet' }}
      </p>
    </UCard>

    <div v-else class="space-y-3">
      <NuxtLink v-for="load in filtered" :key="load.id" :to="`/carrier/loads/${load.id}`" class="block group">
        <UCard class="transition-shadow group-hover:shadow-md">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="flex-1 min-w-48">
              <p class="font-medium text-highlighted">
                <span class="text-muted font-normal tabular-nums mr-1">#{{ formatLoadNumber(load.loadNumber) }}</span>
                {{ load.pickupCity }}, {{ load.pickupState }}
                <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
                {{ load.deliveryCity }}, {{ load.deliveryState }}
                <span v-if="load.truckSeq" class="text-muted font-normal text-sm tabular-nums">· truck {{ load.truckSeq }}/{{ load.trucksTotal }}</span>
                <span v-if="load.jobName" class="text-muted font-normal text-sm">· {{ load.jobName }}</span>
                <UBadge v-if="load.source === 'manual'" variant="subtle" color="neutral" size="sm" class="ml-1">external</UBadge>
              </p>
              <p class="text-sm text-muted mt-0.5">
                {{ load.shipperName ?? load.externalShipperName }} · pickup {{ formatDateTime(load.pickupWindowStart) }}
              </p>
            </div>
            <p v-if="load.driverName" class="text-sm text-muted">
              <UIcon name="i-lucide-user" class="size-3.5 inline" /> {{ load.driverName }}
            </p>
            <UBadge v-else-if="load.status === 'awarded'" color="warning" variant="soft">Needs driver</UBadge>
            <UBadge v-if="load.invoicedAt" variant="subtle" color="success" size="sm" icon="i-lucide-receipt">invoiced</UBadge>
            <UBadge v-else-if="['delivered', 'completed'].includes(load.status) && billable(load)" variant="subtle" color="warning" size="sm">needs invoice</UBadge>
            <p class="font-semibold text-highlighted tabular-nums">{{ formatCents(load.finalPriceCents) }}</p>
            <LoadStatusBadge :status="load.status" />
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
