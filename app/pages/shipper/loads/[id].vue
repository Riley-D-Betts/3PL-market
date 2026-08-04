<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['shipper'] } })

const route = useRoute()
const toast = useToast()
const { data, pending, refresh, error: loadError } = await useFetch(`/api/loads/${route.params.id}`)

useSeoMeta({ title: 'Load details — 3PL Market' })

const load = computed(() => data.value?.load)
const acting = ref(false)

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

const postLoad = () => act(() => $fetch(`/api/loads/${route.params.id}/post`, { method: 'POST' }), 'Load posted to the board')
const unpost = () => act(() => $fetch(`/api/loads/${route.params.id}/unpost`, { method: 'POST' }), 'Load taken off the board')
const cancel = () => act(() => $fetch(`/api/loads/${route.params.id}/cancel`, { method: 'POST' }), 'Load cancelled')
const confirm = () => act(() => $fetch(`/api/loads/${route.params.id}/confirm`, { method: 'POST' }), 'Delivery confirmed — load completed')
const award = (bidId: string) => act(
  () => $fetch(`/api/loads/${route.params.id}/award`, { method: 'POST', body: { bidId } }),
  'Load awarded',
)

async function blockCarrier(companyId: string, companyName: string) {
  const reason = window.prompt(`Block ${companyName} from all your loads? Their pending bids will be rejected.\n\nOptional reason:`)
  if (reason === null) return
  await act(
    () => $fetch('/api/shipper/blocks', { method: 'POST', body: { companyId, reason: reason || undefined } }),
    `${companyName} blocked — manage in Settings`,
  )
}

const pendingBids = computed(() => (data.value?.bids ?? []).filter(b => b.status === 'pending'))
const decidedBids = computed(() => (data.value?.bids ?? []).filter(b => b.status !== 'pending'))

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
    <UAlert color="error" variant="subtle" title="Load not found" :description="apiErrorMessage(loadError)" />
  </div>
  <div v-else-if="load" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-highlighted">
            {{ load.jobName || `${load.pickupCity} → ${load.deliveryCity}` }}
          </h1>
          <UBadge variant="outline" color="neutral" class="tabular-nums">{{ formatLoadNumber(load.loadNumber) }}</UBadge>
          <UBadge v-if="load.truckSeq" variant="soft" color="info" class="tabular-nums">Truck {{ load.truckSeq }}/{{ load.trucksTotal }}</UBadge>
          <LoadStatusBadge :status="load.status" />
        </div>
        <p class="text-sm text-muted mt-1">
          Asking {{ formatCents(load.askingPriceCents) }}
          <template v-if="load.finalPriceCents"> · Final {{ formatCents(load.finalPriceCents) }}</template>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton v-if="load.status === 'draft'" :loading="acting" icon="i-lucide-megaphone" @click="postLoad">Post to board</UButton>
        <UButton v-if="load.status === 'posted'" :loading="acting" variant="outline" color="neutral" icon="i-lucide-undo-2" @click="unpost">Unpost</UButton>
        <UButton v-if="load.status === 'delivered'" :loading="acting" color="success" icon="i-lucide-check" @click="confirm">Confirm delivery</UButton>
        <UButton
          v-if="['draft', 'posted', 'awarded'].includes(load.status)"
          :loading="acting"
          color="error"
          variant="outline"
          icon="i-lucide-ban"
          @click="cancel"
        >
          Cancel load
        </UButton>
      </div>
    </div>

    <UCard>
      <LoadRouteSummary :load="load" />
      <LoadMap class="mt-4" :points="mapPoints" />
      <div v-if="data?.assignedCompany" class="mt-4 pt-4 border-t border-default grid gap-2 sm:grid-cols-3 text-sm">
        <div>
          <p class="text-xs uppercase tracking-wide text-muted">Carrier</p>
          <p class="font-medium text-highlighted">{{ data.assignedCompany.name }}</p>
        </div>
        <div v-if="data?.assignedDriver">
          <p class="text-xs uppercase tracking-wide text-muted">Driver</p>
          <p class="font-medium text-highlighted">{{ data.assignedDriver.name }}</p>
          <p v-if="data.assignedDriver.phone" class="text-muted">{{ data.assignedDriver.phone }}</p>
        </div>
        <div v-if="data?.assignedVehicle">
          <p class="text-xs uppercase tracking-wide text-muted">Vehicle</p>
          <p class="font-medium text-highlighted">
            {{ VEHICLE_TYPE_LABELS[data.assignedVehicle.type] }} · {{ data.assignedVehicle.plate }}
          </p>
        </div>
      </div>
    </UCard>

    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 space-y-6">
        <UCard v-if="load.status === 'posted' || pendingBids.length || decidedBids.length">
          <template #header>
            <h2 class="font-semibold text-highlighted">Bids</h2>
          </template>

          <div v-if="!pendingBids.length && load.status === 'posted'" class="text-sm text-muted py-2">
            No bids yet — carriers can also accept your asking price instantly.
          </div>

          <div v-if="pendingBids.length" class="space-y-3">
            <div v-for="bid in pendingBids" :key="bid.id" class="flex items-start justify-between gap-3 rounded-lg border border-default p-3">
              <div>
                <p class="font-medium text-highlighted">{{ bid.companyName }}</p>
                <p class="text-sm text-muted">{{ formatDateTime(bid.updatedAt) }}</p>
                <p class="text-sm text-muted mt-1">
                  <UIcon name="i-lucide-timer" class="size-3.5 inline" />
                  Detention: {{ formatMinutes(bid.detentionFreeMinutes) }} free · {{ formatCents(bid.detentionRatePerHourCents) }}/hr
                </p>
                <p v-if="bid.note" class="text-sm mt-1">{{ bid.note }}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-semibold text-highlighted tabular-nums">{{ formatCents(bid.amountCents) }}</p>
                <div class="mt-2 flex flex-col items-end gap-1.5">
                  <UButton
                    v-if="load.status === 'posted'"
                    size="sm"
                    :loading="acting"
                    @click="award(bid.id)"
                  >
                    Award
                  </UButton>
                  <UButton
                    size="sm"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-shield-ban"
                    :loading="acting"
                    @click="blockCarrier(bid.companyId, bid.companyName)"
                  >
                    Block carrier
                  </UButton>
                </div>
              </div>
            </div>
          </div>

          <div v-if="decidedBids.length" class="mt-4 space-y-2">
            <p class="text-xs uppercase tracking-wide text-muted">Past bids</p>
            <div v-for="bid in decidedBids" :key="bid.id" class="flex items-center justify-between text-sm py-1.5 border-b border-default last:border-0">
              <span class="text-muted">{{ bid.companyName }}</span>
              <span class="flex items-center gap-2">
                <span class="tabular-nums">{{ formatCents(bid.amountCents) }}</span>
                <UBadge :color="bid.status === 'accepted' ? 'success' : 'neutral'" variant="subtle" size="sm">{{ bid.status }}</UBadge>
              </span>
            </div>
          </div>
        </UCard>
      </div>

      <div class="lg:col-span-2 space-y-6 self-start">
        <LoadChargesCard v-if="!['draft', 'posted', 'cancelled'].includes(load.status)" :load="load" />
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">History</h2>
          </template>
          <EventTimeline :events="data?.events ?? []" />
        </UCard>
      </div>
    </div>
  </div>
  <div v-else-if="pending" class="py-20 text-center text-muted">Loading…</div>
</template>
