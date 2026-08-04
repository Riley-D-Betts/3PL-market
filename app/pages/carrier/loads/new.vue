<script setup lang="ts">
import { MATERIAL_TYPES } from '#shared/types'
import type { MaterialType } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Add external load — 3PL Market' })

const { data: driverData } = await useFetch('/api/fleet/drivers', { server: false, lazy: true })
const { data: vehicleData } = await useFetch('/api/fleet/vehicles', { server: false, lazy: true })

const state = reactive({
  externalShipperName: '',
  externalShipperPhone: '',
  pickupLocationName: '',
  pickupAddress: '',
  pickupCity: '',
  pickupState: '',
  jobName: '',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryState: '',
  materialType: 'aggregate' as MaterialType,
  materialDescription: '',
  weightLbs: null as number | null,
  quantity: '',
  notes: '',
  trucksRequested: 1,
  pickupWindowStart: '',
  pickupWindowEnd: '',
  travelTimeAllowanceMin: null as number | null,
  price: null as number | null,
  pickupContactName: '',
  pickupContactPhone: '',
  deliveryContactName: '',
  deliveryContactPhone: '',
  driverId: undefined as string | undefined,
  vehicleId: undefined as string | undefined,
})
const pending = ref(false)
const error = ref<string | null>(null)

const pickupPin = usePinnedAddress(toRef(state, 'pickupAddress'))
const deliveryPin = usePinnedAddress(toRef(state, 'deliveryAddress'))

// Live drive-time estimate (OSRM) once both stops are filled in.
const driveEstimate = useRouteEstimate({
  pickupCity: toRef(state, 'pickupCity'),
  pickupState: toRef(state, 'pickupState'),
  deliveryCity: toRef(state, 'deliveryCity'),
  deliveryState: toRef(state, 'deliveryState'),
  pickupPin,
  deliveryPin,
})

const materialItems = MATERIAL_TYPES.map(m => ({ label: MATERIAL_TYPE_LABELS[m], value: m }))
const driverItems = computed(() => [
  { label: 'Assign later', value: undefined },
  ...(driverData.value?.drivers ?? []).filter(d => d.isActive).map(d => ({
    label: d.homeBaseCity ? `${d.name} — ${d.homeBaseCity}` : d.name,
    value: d.id,
  })),
])
const vehicleItems = computed(() => [
  { label: 'No vehicle', value: undefined },
  ...(vehicleData.value?.vehicles ?? []).filter(v => v.status === 'active').map(v => ({
    label: `${VEHICLE_TYPE_LABELS[v.type]} · ${v.plate}`,
    value: v.id,
  })),
])

async function submit() {
  error.value = null
  pending.value = true
  try {
    const { load, loads: created } = await $fetch('/api/carrier/loads', {
      method: 'POST',
      body: {
        externalShipperName: state.externalShipperName,
        externalShipperPhone: state.externalShipperPhone || undefined,
        pickupLocationName: state.pickupLocationName || undefined,
        pickupAddress: state.pickupAddress,
        pickupCity: state.pickupCity,
        pickupState: state.pickupState,
        jobName: state.jobName || undefined,
        deliveryAddress: state.deliveryAddress,
        deliveryCity: state.deliveryCity,
        deliveryState: state.deliveryState,
        pickupLat: pickupPin?.value?.lat,
        pickupLng: pickupPin?.value?.lng,
        deliveryLat: deliveryPin?.value?.lat,
        deliveryLng: deliveryPin?.value?.lng,
        materialType: state.materialType,
        materialDescription: state.materialDescription || undefined,
        weightLbs: state.weightLbs,
        quantity: state.quantity || undefined,
        notes: state.notes || undefined,
        trucksRequested: state.trucksRequested || 1,
        pickupWindowStart: state.pickupWindowStart ? new Date(state.pickupWindowStart).toISOString() : undefined,
        pickupWindowEnd: state.pickupWindowEnd ? new Date(state.pickupWindowEnd).toISOString() : undefined,
        // A cleared number input holds '' (not null) — typeof guards treat it as absent.
        travelTimeAllowanceMin: typeof state.travelTimeAllowanceMin === 'number' ? state.travelTimeAllowanceMin : undefined,
        priceCents: typeof state.price === 'number' ? Math.round(state.price * 100) : undefined,
        pickupContactName: state.pickupContactName || undefined,
        pickupContactPhone: state.pickupContactPhone || undefined,
        deliveryContactName: state.deliveryContactName || undefined,
        deliveryContactPhone: state.deliveryContactPhone || undefined,
        driverId: state.driverId,
        vehicleId: state.vehicleId,
      },
    })
    await navigateTo(created.length > 1 ? '/carrier/loads' : `/carrier/loads/${load.id}`)
  }
  catch (err) {
    error.value = apiErrorMessage(err)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-xl font-bold text-highlighted mb-1">Add external load</h1>
    <p class="text-sm text-muted mb-6">
      Freight you booked outside the marketplace — it gets a load number and runs through
      your calendar, day board, driver flow and reports like any other load.
    </p>
    <form class="space-y-6" @submit.prevent="submit">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Customer</h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Customer / shipper name" required>
            <UInput v-model="state.externalShipperName" placeholder="Palouse Sand & Stone" class="w-full" required />
          </UFormField>
          <UFormField label="Customer phone">
            <UInput v-model="state.externalShipperPhone" type="tel" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Route</h2>
          <p class="text-sm text-muted mt-1">Tip: drag a Google Maps pin (or paste its link) into an address field to set the exact spot.</p>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Pickup location name" class="sm:col-span-2">
            <UInput v-model="state.pickupLocationName" placeholder="Pit 4 — Locust Grove yard" class="w-full" />
          </UFormField>
          <UFormField label="Pickup address" required class="sm:col-span-2">
            <UInput v-model="state.pickupAddress" class="w-full" required />
            <p v-if="pickupPin" class="text-xs text-success mt-1">
              <UIcon name="i-lucide-map-pin" class="size-3 inline" /> Pin captured — {{ pickupPin.lat.toFixed(5) }}, {{ pickupPin.lng.toFixed(5) }}
            </p>
          </UFormField>
          <UFormField label="Pickup city" required>
            <UInput v-model="state.pickupCity" class="w-full" required />
          </UFormField>
          <UFormField label="Pickup state" required>
            <UInput v-model="state.pickupState" placeholder="ID" class="w-full" required />
          </UFormField>
          <UFormField label="Job name" class="sm:col-span-2">
            <UInput v-model="state.jobName" placeholder="Costco site — Meridian" class="w-full" />
          </UFormField>
          <UFormField label="Delivery address" required class="sm:col-span-2">
            <UInput v-model="state.deliveryAddress" class="w-full" required />
            <p v-if="deliveryPin" class="text-xs text-success mt-1">
              <UIcon name="i-lucide-map-pin" class="size-3 inline" /> Pin captured — {{ deliveryPin.lat.toFixed(5) }}, {{ deliveryPin.lng.toFixed(5) }}
            </p>
          </UFormField>
          <UFormField label="Delivery city" required>
            <UInput v-model="state.deliveryCity" class="w-full" required />
          </UFormField>
          <UFormField label="Delivery state" required>
            <UInput v-model="state.deliveryState" class="w-full" required />
          </UFormField>
          <UFormField label="Pickup contact">
            <UInput v-model="state.pickupContactName" class="w-full" />
          </UFormField>
          <UFormField label="Pickup contact phone">
            <UInput v-model="state.pickupContactPhone" type="tel" class="w-full" />
          </UFormField>
          <UFormField label="Delivery contact">
            <UInput v-model="state.deliveryContactName" class="w-full" />
          </UFormField>
          <UFormField label="Delivery contact phone">
            <UInput v-model="state.deliveryContactPhone" type="tel" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Cargo & schedule</h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Material" required>
            <USelect v-model="state.materialType" :items="materialItems" class="w-full" />
          </UFormField>
          <UFormField label="Weight (lbs)" required hint="Per truck">
            <UInput v-model.number="state.weightLbs" type="number" min="1" class="w-full" required />
          </UFormField>
          <UFormField label="Quantity">
            <UInput v-model="state.quantity" class="w-full" />
          </UFormField>
          <UFormField label="Description">
            <UInput v-model="state.materialDescription" class="w-full" />
          </UFormField>
          <UFormField label="Notes / instructions" hint="Gates, tarps, scale tickets…" class="sm:col-span-2">
            <UTextarea v-model="state.notes" :rows="3" class="w-full" />
          </UFormField>
          <UFormField label="First load time" required>
            <UInput v-model="state.pickupWindowStart" type="datetime-local" class="w-full" required />
          </UFormField>
          <UFormField label="Last load time" required>
            <UInput v-model="state.pickupWindowEnd" type="datetime-local" class="w-full" required />
          </UFormField>
          <UFormField label="Trucks" required hint="Creates one load per truck">
            <UInput v-model.number="state.trucksRequested" type="number" min="1" max="50" class="w-full" required />
          </UFormField>
          <UFormField label="Travel time allowance (minutes)">
            <UInput v-model.number="state.travelTimeAllowanceMin" type="number" min="0" max="1440" class="w-full" />
            <p v-if="driveEstimate" class="text-xs text-muted mt-1">
              <UIcon name="i-lucide-route" class="size-3 inline" />
              Estimated drive: {{ formatMinutes(driveEstimate.durationMin) }} · {{ formatMiles(driveEstimate.miles) }}
              <UButton size="xs" variant="link" class="p-0" @click="state.travelTimeAllowanceMin = driveEstimate.durationMin">Use as allowance</UButton>
            </p>
          </UFormField>
          <UFormField label="Agreed price (USD)" hint="Optional — internal work needs no rate">
            <UInput v-model.number="state.price" type="number" min="1" step="0.01" class="w-full">
              <template #leading>$</template>
            </UInput>
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Dispatch</h2>
          <p v-if="state.trucksRequested > 1" class="text-sm text-muted mt-1">
            With multiple trucks, the picked driver takes truck 1 — the rest land in the Unassigned lane.
          </p>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Driver" hint="Or assign later from the load page">
            <USelect v-model="state.driverId" :items="driverItems" class="w-full" />
          </UFormField>
          <UFormField label="Vehicle">
            <USelect v-model="state.vehicleId" :items="vehicleItems" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      <UButton type="submit" :loading="pending" icon="i-lucide-plus">
        {{ state.trucksRequested > 1 ? `Add ${state.trucksRequested} loads` : 'Add load' }}
      </UButton>
    </form>
  </div>
</template>
