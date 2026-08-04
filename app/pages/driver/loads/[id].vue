<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['driver'] } })
useSeoMeta({ title: 'Load — 3PL Market' })

const route = useRoute()
const toast = useToast()
const { data, refresh, error: loadError } = await useFetch(`/api/loads/${route.params.id}`)
const load = computed(() => data.value?.load)
const acting = ref(false)

// Live "waiting since" clock for the detention banner.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 30_000)
})
onUnmounted(() => clearInterval(timer))

function waitingText(arrivedAt: string | Date): string {
  const minutes = Math.max(0, Math.floor((now.value - new Date(arrivedAt).getTime()) / 60_000))
  const l = load.value
  let text = `Waiting ${formatMinutes(minutes)}`
  if (l?.detentionFreeMinutes != null && l?.detentionRatePerHourCents != null) {
    text += minutes > l.detentionFreeMinutes
      ? ` — detention accruing at ${formatCents(l.detentionRatePerHourCents)}/hr`
      : ` — free time ${formatMinutes(l.detentionFreeMinutes)}, then ${formatCents(l.detentionRatePerHourCents)}/hr`
  }
  return text
}

async function act(path: string, success: string) {
  acting.value = true
  try {
    await $fetch(`/api/driver/loads/${route.params.id}/${path}`, { method: 'POST' })
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
</script>

<template>
  <div v-if="loadError">
    <UAlert color="error" variant="subtle" title="Load unavailable" :description="apiErrorMessage(loadError)" />
  </div>
  <div v-else-if="load" class="space-y-6 max-w-2xl">
    <div class="flex items-center gap-3">
      <h1 class="text-xl font-bold text-highlighted">{{ load.pickupCity }} → {{ load.deliveryCity }}</h1>
      <LoadStatusBadge :status="load.status" />
    </div>

    <UCard>
      <LoadRouteSummary :load="load" />
      <div class="mt-4 pt-4 border-t border-default text-sm">
        <p class="text-xs uppercase tracking-wide text-muted">Shipper contact</p>
        <p class="font-medium text-highlighted">{{ data?.shipper?.name }}</p>
        <p v-if="data?.shipper?.phone" class="text-muted">{{ data.shipper.phone }}</p>
      </div>
    </UCard>

    <!-- Step 1: heading to pickup -->
    <UButton
      v-if="load.status === 'awarded' && !load.arrivedPickupAt"
      block
      size="xl"
      icon="i-lucide-map-pin"
      :loading="acting"
      @click="act('arrive-pickup', 'Arrival at pickup logged — the wait clock is running')"
    >
      Arrived at pickup
    </UButton>

    <!-- Step 2: waiting/loading at pickup -->
    <template v-else-if="load.status === 'awarded' && load.arrivedPickupAt">
      <UAlert color="info" variant="subtle" icon="i-lucide-timer" :description="waitingText(load.arrivedPickupAt)" />
      <UButton
        block
        size="xl"
        color="primary"
        icon="i-lucide-package-check"
        :loading="acting"
        @click="act('pickup', 'Loaded and rolling — safe travels!')"
      >
        Loaded — departing pickup
      </UButton>
    </template>

    <!-- Step 3: heading to delivery -->
    <UButton
      v-else-if="load.status === 'picked_up' && !load.arrivedDeliveryAt"
      block
      size="xl"
      icon="i-lucide-flag"
      :loading="acting"
      @click="act('arrive-delivery', 'Arrival at delivery logged — the wait clock is running')"
    >
      Arrived at delivery
    </UButton>

    <!-- Step 4: waiting/unloading at delivery -->
    <template v-else-if="load.status === 'picked_up' && load.arrivedDeliveryAt">
      <UAlert color="info" variant="subtle" icon="i-lucide-timer" :description="waitingText(load.arrivedDeliveryAt)" />
      <UButton
        block
        size="xl"
        color="success"
        icon="i-lucide-map-pin-check"
        :loading="acting"
        @click="act('deliver', 'Marked as delivered — nice work!')"
      >
        Unloaded — mark delivered
      </UButton>
    </template>

    <UAlert
      v-else-if="load.status === 'delivered'"
      color="success"
      variant="subtle"
      icon="i-lucide-check-circle-2"
      description="Delivered — waiting for the shipper to confirm."
    />
  </div>
</template>
