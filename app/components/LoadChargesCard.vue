<script setup lang="ts">
interface ChargesLoad {
  status: string
  finalPriceCents: number | null
  detentionFreeMinutes: number | null
  detentionRatePerHourCents: number | null
  arrivedPickupAt: string | Date | null
  arrivedDeliveryAt: string | Date | null
  pickedUpAt: string | Date | null
  deliveredAt: string | Date | null
  pickupDetentionCents: number | null
  deliveryDetentionCents: number | null
}

const props = defineProps<{ load: ChargesLoad }>()

// Live accrual ticker for a wait that is still running (informational only —
// the server freezes the authoritative amount at departure).
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 30_000)
})
onUnmounted(() => clearInterval(timer))

function liveAccrual(arrivedAt: string | Date | null): number | null {
  if (!arrivedAt || props.load.detentionRatePerHourCents == null) return null
  const waited = Math.floor((now.value - new Date(arrivedAt).getTime()) / 60_000)
  const over = Math.max(0, waited - (props.load.detentionFreeMinutes ?? 0))
  return Math.ceil((over * props.load.detentionRatePerHourCents) / 60)
}

const pickupWaiting = computed(() =>
  props.load.status === 'awarded' && props.load.arrivedPickupAt && !props.load.pickedUpAt)
const deliveryWaiting = computed(() =>
  props.load.status === 'picked_up' && props.load.arrivedDeliveryAt && !props.load.deliveredAt)

const pickupCents = computed(() =>
  pickupWaiting.value ? liveAccrual(props.load.arrivedPickupAt) : props.load.pickupDetentionCents)
const deliveryCents = computed(() =>
  deliveryWaiting.value ? liveAccrual(props.load.arrivedDeliveryAt) : props.load.deliveryDetentionCents)

// Price-less internal loads have nothing to total — show a dash, not $0.00.
const hasAnyCharge = computed(() =>
  props.load.finalPriceCents != null
  || props.load.pickupDetentionCents != null
  || props.load.deliveryDetentionCents != null)

const totalCents = computed(() =>
  hasAnyCharge.value
    ? (props.load.finalPriceCents ?? 0)
      + (props.load.pickupDetentionCents ?? 0)
      + (props.load.deliveryDetentionCents ?? 0)
    : null)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-highlighted">Charges</h2>
        <p v-if="load.detentionFreeMinutes != null" class="text-xs text-muted">
          Detention terms: {{ formatMinutes(load.detentionFreeMinutes) }} free · {{ formatCents(load.detentionRatePerHourCents) }}/hr
        </p>
      </div>
    </template>
    <dl class="space-y-2 text-sm">
      <div class="flex justify-between">
        <dt class="text-muted">Line haul</dt>
        <dd class="font-medium text-highlighted tabular-nums">{{ formatCents(load.finalPriceCents) }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted">Pickup detention</dt>
        <dd class="tabular-nums">
          <UBadge v-if="pickupWaiting" color="warning" variant="subtle" size="sm" class="mr-1.5">accruing</UBadge>
          <span :class="pickupCents ? 'font-medium text-highlighted' : 'text-muted'">{{ formatCents(pickupCents) }}</span>
        </dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted">Delivery detention</dt>
        <dd class="tabular-nums">
          <UBadge v-if="deliveryWaiting" color="warning" variant="subtle" size="sm" class="mr-1.5">accruing</UBadge>
          <span :class="deliveryCents ? 'font-medium text-highlighted' : 'text-muted'">{{ formatCents(deliveryCents) }}</span>
        </dd>
      </div>
      <div class="flex justify-between border-t border-default pt-2 mt-2">
        <dt class="font-medium text-highlighted">Total due</dt>
        <dd class="font-semibold text-highlighted tabular-nums">{{ formatCents(totalCents) }}</dd>
      </div>
    </dl>
    <p v-if="pickupWaiting || deliveryWaiting" class="mt-3 text-xs text-muted">
      Accruing amounts are estimates — the final fee is fixed when the truck departs.
    </p>
  </UCard>
</template>
