<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Won loads — 3PL Market' })

const { data, pending, error } = await useFetch('/api/carrier/loads')
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-highlighted">Won loads</h1>
      <UButton to="/carrier/loads/new" variant="outline" icon="i-lucide-plus">Add external load</UButton>
    </div>

    <UAlert v-if="error" color="warning" variant="subtle" :description="apiErrorMessage(error)" />

    <UCard v-else-if="!pending && !data?.loads?.length" class="text-center py-10">
      <UIcon name="i-lucide-trophy" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">No won loads yet</p>
      <p class="text-sm text-muted">Accept or win a bid on the load board and it will show up here.</p>
      <UButton to="/carrier/board" class="mt-4" icon="i-lucide-search">Browse the board</UButton>
    </UCard>

    <div v-else class="space-y-3">
      <NuxtLink v-for="load in data?.loads" :key="load.id" :to="`/carrier/loads/${load.id}`" class="block group">
        <UCard class="transition-shadow group-hover:shadow-md">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="flex-1 min-w-48">
              <p class="font-medium text-highlighted">
                <span class="text-muted font-normal tabular-nums mr-1">#{{ formatLoadNumber(load.loadNumber) }}</span>
                {{ load.pickupCity }}, {{ load.pickupState }}
                <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
                {{ load.deliveryCity }}, {{ load.deliveryState }}
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
            <p class="font-semibold text-highlighted tabular-nums">{{ formatCents(load.finalPriceCents) }}</p>
            <LoadStatusBadge :status="load.status" />
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
