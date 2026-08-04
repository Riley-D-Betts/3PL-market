<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Load details — 3PL Market' })

const route = useRoute()
const toast = useToast()
const { data, refresh, error: loadError } = await useFetch(`/api/loads/${route.params.id}`)

const load = computed(() => data.value?.load)
const myBid = computed(() => data.value?.myBid)
const myPendingBid = computed(() => (myBid.value?.status === 'pending' ? myBid.value : null))

const bidAmount = ref<number | null>(null)
const bidNote = ref('')
const acting = ref(false)

// Detention terms for the two paths (dollars in the UI, cents on the wire).
const acceptFreeMinutes = ref(120)
const acceptRatePerHour = ref(75)
const bidFreeMinutes = ref(120)
const bidRatePerHour = ref(75)

// Re-bidding starts from the terms of the live bid.
watch(myPendingBid, (bid) => {
  if (bid) {
    bidFreeMinutes.value = bid.detentionFreeMinutes
    bidRatePerHour.value = bid.detentionRatePerHourCents / 100
  }
}, { immediate: true })

async function act(fn: () => Promise<unknown>, success: string) {
  acting.value = true
  try {
    await fn()
    await refresh()
    toast.add({ title: success, color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    acting.value = false
  }
}

async function acceptNow() {
  await act(async () => {
    await $fetch(`/api/loads/${route.params.id}/accept`, {
      method: 'POST',
      body: {
        detentionFreeMinutes: acceptFreeMinutes.value,
        detentionRatePerHourCents: Math.round(acceptRatePerHour.value * 100),
      },
    })
    await navigateTo(`/carrier/loads/${route.params.id}`)
  }, 'Load is yours — assign a driver')
}

const placeBid = () => act(async () => {
  if (!bidAmount.value) throw new Error('Enter a bid amount')
  await $fetch(`/api/loads/${route.params.id}/bids`, {
    method: 'POST',
    body: {
      amountCents: Math.round(bidAmount.value * 100),
      note: bidNote.value || undefined,
      detentionFreeMinutes: bidFreeMinutes.value,
      detentionRatePerHourCents: Math.round(bidRatePerHour.value * 100),
    },
  })
  bidAmount.value = null
  bidNote.value = ''
}, 'Bid placed')

const withdraw = () => act(async () => {
  if (!myPendingBid.value) return
  await $fetch(`/api/bids/${myPendingBid.value.id}`, { method: 'DELETE' })
}, 'Bid withdrawn')

const mapPoints = computed(() => {
  const l = load.value
  if (!l) return []
  return [
    { kind: 'pickup' as const, lat: l.pickupLat, lng: l.pickupLng, label: `Pickup — ${l.pickupCity}, ${l.pickupState}` },
    { kind: 'delivery' as const, lat: l.deliveryLat, lng: l.deliveryLng, label: `Delivery — ${l.deliveryCity}, ${l.deliveryState}` },
  ]
})
</script>

<template>
  <div v-if="loadError">
    <UAlert color="error" variant="subtle" title="Load unavailable" :description="apiErrorMessage(loadError)" />
  </div>
  <div v-else-if="load" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-highlighted">{{ load.pickupCity }} → {{ load.deliveryCity }}</h1>
          <UBadge variant="outline" color="neutral" class="tabular-nums">{{ formatLoadNumber(load.loadNumber) }}</UBadge>
          <LoadStatusBadge :status="load.status" />
        </div>
        <p class="text-sm text-muted mt-1">Posted by {{ data?.shipper?.name }}</p>
      </div>
      <p class="text-2xl font-bold text-highlighted tabular-nums">{{ formatCents(load.askingPriceCents) }}</p>
    </div>

    <UCard>
      <LoadRouteSummary :load="load" />
      <LoadMap class="mt-4" :points="mapPoints" />
    </UCard>

    <UCard v-if="load.status === 'posted'">
      <template #header>
        <h2 class="font-semibold text-highlighted">Take this load</h2>
      </template>
      <div class="grid gap-6 md:grid-cols-2">
        <div class="rounded-lg border border-default p-4">
          <p class="font-medium text-highlighted">Accept at asking price</p>
          <p class="text-sm text-muted mt-1">
            Instantly win the load for {{ formatCents(load.askingPriceCents) }}. First carrier to accept gets it.
          </p>
          <div class="mt-3">
            <DetentionTermsInputs v-model:free-minutes="acceptFreeMinutes" v-model:rate-per-hour="acceptRatePerHour" />
          </div>
          <UButton class="mt-3" color="success" icon="i-lucide-zap" :loading="acting" @click="acceptNow">
            Accept {{ formatCents(load.askingPriceCents) }}
          </UButton>
        </div>
        <div class="rounded-lg border border-default p-4">
          <p class="font-medium text-highlighted">{{ myPendingBid ? 'Update your bid' : 'Counter-bid' }}</p>
          <p v-if="myPendingBid" class="text-sm text-muted mt-1">
            Current bid: {{ formatCents(myPendingBid.amountCents) }}
            ({{ formatMinutes(myPendingBid.detentionFreeMinutes) }} free · {{ formatCents(myPendingBid.detentionRatePerHourCents) }}/hr)
            — placing a new one replaces it.
          </p>
          <div class="mt-3 space-y-3">
            <UInput v-model.number="bidAmount" type="number" min="1" step="0.01" placeholder="Your price (USD)" class="w-full">
              <template #leading>$</template>
            </UInput>
            <DetentionTermsInputs v-model:free-minutes="bidFreeMinutes" v-model:rate-per-hour="bidRatePerHour" />
            <UTextarea v-model="bidNote" placeholder="Optional note to the shipper" :rows="2" class="w-full" />
            <div class="flex gap-2">
              <UButton icon="i-lucide-gavel" :loading="acting" @click="placeBid">
                {{ myPendingBid ? 'Update bid' : 'Place bid' }}
              </UButton>
              <UButton v-if="myPendingBid" variant="outline" color="neutral" :loading="acting" @click="withdraw">
                Withdraw
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </UCard>
    <UAlert
      v-else
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      description="This load is no longer open for bidding."
    />
  </div>
</template>
