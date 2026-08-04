<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Bids — 3PL Market' })

const toast = useToast()
const { data, pending, refresh, error } = await useFetch('/api/bids')

const BID_COLORS: Record<string, 'info' | 'success' | 'neutral' | 'warning'> = {
  pending: 'info',
  accepted: 'success',
  rejected: 'neutral',
  withdrawn: 'warning',
}

async function withdraw(bidId: string) {
  try {
    await $fetch(`/api/bids/${bidId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Bid withdrawn', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-highlighted mb-6">Bid history</h1>

    <UAlert v-if="error" color="warning" variant="subtle" :description="apiErrorMessage(error)" />

    <UCard v-else-if="!pending && !data?.bids?.length" class="text-center py-10">
      <UIcon name="i-lucide-gavel" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">No bids yet</p>
      <UButton to="/carrier/board" class="mt-4" icon="i-lucide-search">Browse the board</UButton>
    </UCard>

    <div v-else class="space-y-3">
      <UCard v-for="bid in data?.bids" :key="bid.id">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="flex-1 min-w-48">
            <NuxtLink
              :to="bid.status === 'pending' ? `/carrier/board/${bid.loadId}` : `/carrier/loads/${bid.loadId}`"
              class="font-medium text-highlighted hover:text-primary"
            >
              {{ bid.pickupCity }}, {{ bid.pickupState }}
              <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
              {{ bid.deliveryCity }}, {{ bid.deliveryState }}
            </NuxtLink>
            <p class="text-sm text-muted mt-0.5">
              {{ MATERIAL_TYPE_LABELS[bid.materialType] }} · {{ formatWeight(bid.weightKg) }}
              · asking {{ formatCents(bid.askingPriceCents) }} · {{ formatDateTime(bid.updatedAt) }}
            </p>
          </div>
          <p class="font-semibold text-highlighted tabular-nums">{{ formatCents(bid.amountCents) }}</p>
          <UBadge :color="BID_COLORS[bid.status] ?? 'neutral'" variant="subtle">{{ bid.status }}</UBadge>
          <UButton
            v-if="bid.status === 'pending'"
            size="sm"
            variant="outline"
            color="neutral"
            @click="withdraw(bid.id)"
          >
            Withdraw
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
