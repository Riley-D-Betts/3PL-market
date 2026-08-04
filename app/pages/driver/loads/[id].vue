<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['driver'] } })
useSeoMeta({ title: 'Load — 3PL Market' })

const route = useRoute()
const toast = useToast()
const { data, refresh, error: loadError } = await useFetch(`/api/loads/${route.params.id}`)
const load = computed(() => data.value?.load)
const acting = ref(false)

// Load actions 409 without an active shift — surface that up front.
const { data: shiftData } = await useFetch('/api/driver/shift', { server: false, lazy: true })
const offDuty = computed(() => shiftData.value != null && !shiftData.value.shift)

// ── Delivery paperwork: scale-ticket photos + actual tonnage ────────────────
const tickets = computed(() => (data.value?.attachments ?? []).filter(a => a.kind === 'ticket'))
const deliveredTons = ref<number | null>(null)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function uploadTicket(ev: Event) {
  const files = (ev.target as HTMLInputElement).files
  if (!files?.length) return
  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      await $fetch(`/api/driver/loads/${route.params.id}/ticket`, { method: 'POST', body: form })
    }
    await refresh()
    toast.add({ title: 'Ticket photo attached', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function deliver() {
  acting.value = true
  try {
    await $fetch(`/api/driver/loads/${route.params.id}/deliver`, {
      method: 'POST',
      body: { deliveredTons: deliveredTons.value },
    })
    await refresh()
    toast.add({ title: 'Marked as delivered — nice work!', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    acting.value = false
  }
}

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

const mapPoints = computed(() => {
  const l = load.value
  if (!l) return []
  const points: { kind: 'pickup' | 'delivery' | 'home', lat: number | null, lng: number | null, label: string }[] = [
    { kind: 'pickup', lat: l.pickupLat, lng: l.pickupLng, label: `Pickup — ${l.pickupCity}, ${l.pickupState}` },
    { kind: 'delivery', lat: l.deliveryLat, lng: l.deliveryLng, label: `Delivery — ${l.deliveryCity}, ${l.deliveryState}` },
  ]
  const d = data.value?.assignedDriver
  if (d?.homeBaseLat != null && d?.homeBaseLng != null) {
    points.push({ kind: 'home', lat: d.homeBaseLat, lng: d.homeBaseLng, label: `Home base — ${d.homeBaseCity ?? ''}` })
  }
  return points
})

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
      <h1 class="text-xl font-bold text-highlighted">{{ load.jobName || `${load.pickupCity} → ${load.deliveryCity}` }}</h1>
      <UBadge variant="outline" color="neutral" class="tabular-nums">{{ formatLoadNumber(load.loadNumber) }}</UBadge>
      <UBadge v-if="load.truckSeq" variant="soft" color="info" class="tabular-nums">Truck {{ load.truckSeq }}/{{ load.trucksTotal }}</UBadge>
      <LoadStatusBadge :status="load.status" />
    </div>

    <UAlert
      v-if="offDuty && ['awarded', 'picked_up'].includes(load.status)"
      color="warning"
      variant="subtle"
      icon="i-lucide-sunrise"
    >
      <template #description>
        You're not signed on — <NuxtLink to="/driver" class="font-medium underline">start your shift</NuxtLink>
        (truck, pre-trip, beginning mileage) to unlock load actions.
      </template>
    </UAlert>

    <UCard>
      <LoadRouteSummary :load="load" />
      <LoadMap class="mt-4" :points="mapPoints" :route="data?.route" />
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

    <!-- Step 4: waiting/unloading at delivery — paperwork before sign-off -->
    <template v-else-if="load.status === 'picked_up' && load.arrivedDeliveryAt">
      <UAlert color="info" variant="subtle" icon="i-lucide-timer" :description="waitingText(load.arrivedDeliveryAt)" />
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Delivery paperwork</h2>
          <p class="text-sm text-muted mt-1">A photo of the scale ticket and the delivered tonnage are required to close out the load.</p>
        </template>
        <div class="space-y-4">
          <UFormField label="Scale ticket photo" required>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              capture="environment"
              class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
              :disabled="uploading"
              @change="uploadTicket"
            >
            <p v-if="uploading" class="text-xs text-muted mt-1">Uploading…</p>
            <ul v-if="tickets.length" class="mt-2 space-y-1">
              <li v-for="t in tickets" :key="t.id" class="text-sm flex items-center gap-1.5">
                <UIcon name="i-lucide-receipt" class="size-3.5 text-success" />
                <a :href="`/api/loads/${load.id}/attachments/${t.id}`" target="_blank" class="underline text-highlighted">
                  {{ t.filename || 'ticket photo' }}
                </a>
                <span class="text-muted">· {{ formatDateTime(t.createdAt) }}</span>
              </li>
            </ul>
          </UFormField>
          <UFormField label="Delivered tonnage (tons)" required hint="Off the scale ticket">
            <UInput v-model.number="deliveredTons" type="number" min="0.1" max="100" step="0.1" class="w-full" />
          </UFormField>
          <UButton
            block
            size="xl"
            color="success"
            icon="i-lucide-map-pin-check"
            :loading="acting"
            :disabled="!tickets.length || typeof deliveredTons !== 'number' || deliveredTons <= 0"
            @click="deliver"
          >
            Unloaded — mark delivered
          </UButton>
          <p v-if="!tickets.length" class="text-xs text-muted text-center">Attach the ticket photo first.</p>
        </div>
      </UCard>
    </template>

    <template v-else-if="load.status === 'delivered'">
      <UAlert
        color="success"
        variant="subtle"
        icon="i-lucide-check-circle-2"
        :description="`Delivered${load.deliveredTons ? ` — ${load.deliveredTons} tons` : ''} — waiting for the shipper to confirm.`"
      />
      <UCard v-if="tickets.length">
        <p class="text-xs uppercase tracking-wide text-muted mb-2">Scale tickets</p>
        <div class="flex flex-wrap gap-3">
          <a v-for="t in tickets" :key="t.id" :href="`/api/loads/${load.id}/attachments/${t.id}`" target="_blank" class="block">
            <img :src="`/api/loads/${load.id}/attachments/${t.id}`" :alt="t.filename || 'ticket'" class="h-24 rounded-lg border border-default object-cover">
          </a>
        </div>
      </UCard>
    </template>
  </div>
</template>
