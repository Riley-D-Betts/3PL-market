<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['driver'] } })
useSeoMeta({ title: 'My loads — 3PL Market' })

const { data, pending, error } = await useFetch('/api/driver/loads')

const active = computed(() => (data.value?.loads ?? []).filter(l => ['awarded', 'picked_up'].includes(l.status)))
const past = computed(() => (data.value?.loads ?? []).filter(l => !['awarded', 'picked_up'].includes(l.status)))
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold text-highlighted">My loads</h1>

    <UAlert v-if="error" color="error" variant="subtle" title="Could not load your loads" :description="apiErrorMessage(error)" />

    <UCard v-else-if="!pending && !active.length && !past.length" class="text-center py-10">
      <UIcon name="i-lucide-coffee" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">Nothing assigned right now</p>
      <p class="text-sm text-muted">Your dispatcher will assign loads to you here.</p>
    </UCard>

    <template v-if="active.length">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted -mb-3">Up next</h2>
      <NuxtLink v-for="load in active" :key="load.id" :to="`/driver/loads/${load.id}`" class="block group">
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
                · pickup {{ formatDateTime(load.pickupWindowStart) }}
                <span v-if="load.vehiclePlate"> · {{ load.vehiclePlate }}</span>
              </p>
            </div>
            <LoadStatusBadge :status="load.status" />
            <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
          </div>
        </UCard>
      </NuxtLink>
    </template>

    <template v-if="past.length">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted -mb-3">History</h2>
      <NuxtLink v-for="load in past" :key="load.id" :to="`/driver/loads/${load.id}`" class="block group">
        <UCard class="transition-shadow group-hover:shadow-md">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p class="flex-1 min-w-48 text-highlighted">
              {{ load.pickupCity }} → {{ load.deliveryCity }}
            </p>
            <LoadStatusBadge :status="load.status" />
          </div>
        </UCard>
      </NuxtLink>
    </template>
  </div>
</template>
