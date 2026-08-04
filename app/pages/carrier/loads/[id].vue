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

const driverItems = computed(() =>
  (driverData.value?.drivers ?? [])
    .filter(d => d.isActive)
    .map(d => ({ label: d.name, value: d.id })))
const vehicleItems = computed(() => [
  { label: 'No vehicle', value: undefined },
  ...(vehicleData.value?.vehicles ?? [])
    .filter(v => v.status === 'active')
    .map(v => ({ label: `${VEHICLE_TYPE_LABELS[v.type]} · ${v.plate}`, value: v.id })),
])

const selectedDriver = ref<string | undefined>(undefined)
const selectedVehicle = ref<string | undefined>(undefined)
const acting = ref(false)

watchEffect(() => {
  if (load.value?.assignedDriverId && !selectedDriver.value) selectedDriver.value = load.value.assignedDriverId
  if (load.value?.assignedVehicleId && !selectedVehicle.value) selectedVehicle.value = load.value.assignedVehicleId
})

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
          <LoadStatusBadge :status="load.status" />
        </div>
        <p class="text-sm text-muted mt-1">
          {{ data?.shipper?.name }}<span v-if="data?.shipper?.phone"> · {{ data.shipper.phone }}</span>
          · {{ formatCents(load.finalPriceCents ?? load.askingPriceCents) }}
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

      <UCard class="lg:col-span-2 self-start">
        <template #header>
          <h2 class="font-semibold text-highlighted">History</h2>
        </template>
        <EventTimeline :events="data?.events ?? []" />
      </UCard>
    </div>
  </div>
</template>
