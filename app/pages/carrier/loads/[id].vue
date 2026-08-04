<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Load dispatch — 3PL Market' })

const route = useRoute()
const toast = useToast()
const { data, refresh, error: loadError } = await useFetch(`/api/loads/${route.params.id}`)
const load = computed(() => data.value?.load)

const canAssign = computed(() => load.value && ['awarded', 'picked_up'].includes(load.value.status))

// Fleet + drivers for the assignment form.
const { data: driverData } = await useFetch('/api/fleet/drivers', { server: false, lazy: true })
const { data: vehicleData } = await useFetch('/api/fleet/vehicles', { server: false, lazy: true })

// Selectable = active; the currently assigned driver/vehicle is kept in the
// list even when inactive so the select renders a name, not a raw id.
const driverItems = computed(() => {
  const drivers = driverData.value?.drivers ?? []
  const items = drivers.filter(d => d.isActive).map(d => ({
    label: d.homeBaseCity ? `${d.name} — ${d.homeBaseCity}` : d.name,
    value: d.id,
  }))
  const assigned = drivers.find(d => d.id === load.value?.assignedDriverId)
  if (assigned && !assigned.isActive) {
    items.unshift({ label: `${assigned.name} (inactive)`, value: assigned.id })
  }
  return items
})
const vehicleItems = computed(() => {
  const vehicles = vehicleData.value?.vehicles ?? []
  const items: { label: string, value: string | undefined }[] = [
    { label: 'No vehicle', value: undefined },
    ...vehicles.filter(v => v.status === 'active')
      .map(v => ({ label: `${VEHICLE_TYPE_LABELS[v.type]} · ${v.plate}`, value: v.id })),
  ]
  const assigned = vehicles.find(v => v.id === load.value?.assignedVehicleId)
  if (assigned && assigned.status !== 'active') {
    items.splice(1, 0, { label: `${VEHICLE_TYPE_LABELS[assigned.type]} · ${assigned.plate} (${assigned.status})`, value: assigned.id })
  }
  return items
})

const selectedDriver = ref<string | undefined>(undefined)
const selectedVehicle = ref<string | undefined>(undefined)
const acting = ref(false)

// Initialize the selects from the load once — never fight later user edits
// (a watchEffect here would revert clearing the vehicle back to undefined).
watch(load, (l) => {
  if (!l) return
  selectedDriver.value = l.assignedDriverId ?? undefined
  selectedVehicle.value = l.assignedVehicleId ?? undefined
}, { once: true, immediate: true })

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

const assign = () => act(async () => {
  if (!selectedDriver.value) throw new Error('Pick a driver first')
  await $fetch(`/api/loads/${route.params.id}/assign`, {
    method: 'POST',
    body: { driverId: selectedDriver.value, vehicleId: selectedVehicle.value ?? null },
  })
}, 'Driver assigned')

const backOut = () => act(
  () => $fetch(`/api/loads/${route.params.id}/cancel`, { method: 'POST' }),
  'Load cancelled',
)

// Next-leg planner: open loads near where this run ends, rated against the
// selected vehicle. Advisory — refreshed when the vehicle selection changes.
const plannerActive = computed(() => load.value && ['awarded', 'picked_up'].includes(load.value.status))
const { data: nextLegs } = await useFetch('/api/carrier/next-loads', {
  query: computed(() => ({
    fromLoadId: route.params.id as string,
    vehicleId: selectedVehicle.value ?? undefined,
  })),
  server: false,
  lazy: true,
  immediate: true,
  ignoreResponseError: true,
  watch: [selectedVehicle],
})

const mapPoints = computed(() => {
  const l = load.value
  if (!l) return []
  const points: { kind: 'pickup' | 'delivery' | 'home', lat: number | null, lng: number | null, label: string }[] = [
    { kind: 'pickup', lat: l.pickupLat, lng: l.pickupLng, label: `Pickup — ${l.pickupCity}, ${l.pickupState}` },
    { kind: 'delivery', lat: l.deliveryLat, lng: l.deliveryLng, label: `Delivery — ${l.deliveryCity}, ${l.deliveryState}` },
  ]
  const d = data.value?.assignedDriver
  if (d?.homeBaseLat != null && d?.homeBaseLng != null) {
    points.push({
      kind: 'home',
      lat: d.homeBaseLat,
      lng: d.homeBaseLng,
      label: `${d.name} — home base ${d.homeBaseCity ?? ''}`,
    })
  }
  return points
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
          <UBadge v-if="load.source === 'manual'" variant="subtle" color="neutral">external</UBadge>
          <LoadStatusBadge :status="load.status" />
        </div>
        <p class="text-sm text-muted mt-1">
          {{ data?.shipper?.name }}<span v-if="data?.shipper?.phone"> · {{ data.shipper.phone }}</span>
          · {{ formatCents(load.finalPriceCents ?? load.askingPriceCents) }}
        </p>
        <p v-if="data?.invoiceEmail" class="text-sm text-muted mt-0.5">
          <UIcon name="i-lucide-receipt" class="size-3.5 inline" />
          Send invoices to <span class="font-medium text-highlighted">{{ data.invoiceEmail }}</span>
        </p>
      </div>
      <UButton
        v-if="load.status === 'awarded'"
        color="error"
        variant="outline"
        icon="i-lucide-ban"
        :loading="acting"
        @click="backOut"
      >
        Back out
      </UButton>
    </div>

    <UCard>
      <LoadRouteSummary :load="load" />
      <LoadMap class="mt-4" :points="mapPoints" />
    </UCard>

    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 space-y-6">
        <UCard v-if="canAssign">
          <template #header>
            <h2 class="font-semibold text-highlighted">
              {{ load.assignedDriverId ? 'Reassign driver & vehicle' : 'Assign driver & vehicle' }}
            </h2>
          </template>
          <div class="space-y-4">
            <UAlert
              v-if="!driverItems.length"
              color="warning"
              variant="subtle"
              icon="i-lucide-alert-triangle"
            >
              <template #description>
                No active drivers yet — <NuxtLink to="/carrier/drivers" class="font-medium underline">add a driver</NuxtLink> first.
              </template>
            </UAlert>
            <UFormField label="Driver" required>
              <USelect v-model="selectedDriver" :items="driverItems" placeholder="Pick a driver" class="w-full" />
            </UFormField>
            <UFormField label="Vehicle" hint="Optional">
              <USelect v-model="selectedVehicle" :items="vehicleItems" placeholder="No vehicle" class="w-full" />
            </UFormField>
            <UButton icon="i-lucide-user-check" :loading="acting" :disabled="!selectedDriver" @click="assign">
              {{ load.assignedDriverId ? 'Update assignment' : 'Assign' }}
            </UButton>
          </div>
        </UCard>

        <UCard v-if="data?.assignedDriver">
          <template #header>
            <h2 class="font-semibold text-highlighted">Current assignment</h2>
          </template>
          <div class="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
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
      </div>

      <div class="lg:col-span-2 space-y-6 self-start">
        <LoadChargesCard :load="load" />
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">History</h2>
          </template>
          <EventTimeline :events="data?.events ?? []" />
        </UCard>
      </div>
    </div>

    <UCard v-if="plannerActive && nextLegs?.suggestions?.length">
      <template #header>
        <h2 class="font-semibold text-highlighted">Plan the next leg</h2>
        <p class="text-sm text-muted mt-1">
          Open loads near {{ nextLegs.from.city }}, {{ nextLegs.from.state }} — where this run ends<template v-if="nextLegs.vehicle">, rated for {{ nextLegs.vehicle.plate }} ({{ formatWeight(nextLegs.vehicle.capacityKg) }} capacity)</template>.
        </p>
      </template>
      <div class="space-y-2">
        <NuxtLink
          v-for="candidate in nextLegs.suggestions"
          :key="candidate.id"
          :to="`/carrier/board/${candidate.id}`"
          class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-default p-3 hover:bg-elevated transition-colors"
        >
          <UBadge variant="soft" color="info" class="tabular-nums shrink-0 w-20 justify-center">
            {{ formatKm(candidate.distanceKm) }}
          </UBadge>
          <div class="flex-1 min-w-48">
            <p class="font-medium text-highlighted">
              <span class="text-muted font-normal tabular-nums mr-1">#{{ formatLoadNumber(candidate.loadNumber) }}</span>
              {{ candidate.pickupCity }}, {{ candidate.pickupState }}
              <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
              {{ candidate.deliveryCity }}, {{ candidate.deliveryState }}
            </p>
            <p class="text-sm text-muted mt-0.5">
              {{ MATERIAL_TYPE_LABELS[candidate.materialType] }} · {{ formatWeight(candidate.weightKg) }}
              · pickup {{ formatDate(candidate.pickupWindowStart) }}
            </p>
          </div>
          <span v-if="candidate.fitsCapacity !== null" class="flex gap-1.5">
            <UBadge :color="candidate.fitsCapacity ? 'success' : 'error'" variant="subtle" size="sm">
              {{ candidate.fitsCapacity ? 'fits capacity' : 'too heavy' }}
            </UBadge>
            <UBadge v-if="candidate.materialFit !== null" :color="candidate.materialFit ? 'success' : 'warning'" variant="subtle" size="sm">
              {{ candidate.materialFit ? 'material fit' : 'check body type' }}
            </UBadge>
          </span>
          <p class="font-semibold text-highlighted tabular-nums">{{ formatCents(candidate.askingPriceCents) }}</p>
        </NuxtLink>
      </div>
    </UCard>
  </div>
</template>
