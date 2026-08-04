<script setup lang="ts">
import { PRETRIP_ITEMS } from '#shared/types'
import type { PretripItem } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['driver'] } })
useSeoMeta({ title: 'My day — 3PL Market' })

const route = useRoute()
const toast = useToast()
const { clear } = useUserSession()

const { data, pending, error } = await useFetch('/api/driver/loads')
const { data: shiftData, refresh: refreshShift } = await useFetch('/api/driver/shift')

const active = computed(() => (data.value?.loads ?? []).filter(l => ['awarded', 'picked_up'].includes(l.status)))
const past = computed(() => (data.value?.loads ?? []).filter(l => !['awarded', 'picked_up'].includes(l.status)))

const shift = computed(() => shiftData.value?.shift ?? null)
const shiftVehicle = computed(() => shiftData.value?.vehicle ?? null)
const fleet = computed(() => shiftData.value?.fleet ?? [])

// ── Sign on: truck, pre-trip, begin mileage ─────────────────────────────────
const pretripKeys = Object.keys(PRETRIP_ITEMS) as PretripItem[]
const startForm = reactive({
  vehicleId: undefined as string | undefined,
  startOdometerMi: null as number | null,
  checklist: Object.fromEntries(pretripKeys.map(k => [k, false])) as Record<PretripItem, boolean>,
  defects: '',
})
const starting = ref(false)
const mileageEdited = ref(false)

const truckItems = computed(() => fleet.value.map(v => ({
  label: `${VEHICLE_TYPE_LABELS[v.type]} · ${v.plate}`,
  value: v.id,
})))

// Picking a truck prefills the begin mileage with its last known odometer —
// unless the driver already typed their own reading.
watch(() => startForm.vehicleId, (id) => {
  const v = fleet.value.find(x => x.id === id)
  if (v?.odometerMi != null && !mileageEdited.value) startForm.startOdometerMi = v.odometerMi
})

const allChecked = computed(() => pretripKeys.every(k => startForm.checklist[k]))
function checkAll() {
  pretripKeys.forEach((k) => { startForm.checklist[k] = true })
}
// Any unchecked inspection item demands a written defect note before sign-on.
const needsDefects = computed(() => !allChecked.value && !startForm.defects.trim())

async function startShift() {
  starting.value = true
  try {
    await $fetch('/api/driver/shift/start', {
      method: 'POST',
      body: {
        vehicleId: startForm.vehicleId,
        startOdometerMi: startForm.startOdometerMi,
        checklist: startForm.checklist,
        defects: startForm.defects || undefined,
      },
    })
    await refreshShift()
    toast.add({ title: 'Shift started — have a safe day', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    starting.value = false
  }
}

// ── Sign off: ending mileage + fuel ─────────────────────────────────────────
// The logout flow lands here with ?end-shift=1: open the form, remember the
// intent, and strip the param so a later manual sign-off doesn't log out.
const router = useRouter()
const showEndForm = ref(false)
const endShiftThenLogout = ref(false)
watch(() => route.query['end-shift'], (v) => {
  if (v === '1') {
    showEndForm.value = true
    endShiftThenLogout.value = true
    router.replace({ query: {} })
  }
}, { immediate: true })
const endForm = reactive({ endOdometerMi: null as number | null, fuelGallons: null as number | null })
const ending = ref(false)

watch(shift, (s) => {
  if (s && endForm.endOdometerMi == null) endForm.endOdometerMi = s.startOdometerMi
}, { immediate: true })

async function endShift() {
  ending.value = true
  try {
    await $fetch('/api/driver/shift/end', {
      method: 'POST',
      body: { endOdometerMi: endForm.endOdometerMi, fuelGallons: endForm.fuelGallons },
    })
    toast.add({ title: 'Shift ended — see you tomorrow', color: 'success' })
    // Ending the shift from the logout flow finishes the logout.
    if (endShiftThenLogout.value) {
      await $fetch('/api/auth/logout', { method: 'POST' })
      await clear()
      await navigateTo('/login')
      return
    }
    showEndForm.value = false
    await refreshShift()
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    ending.value = false
  }
}

const milesSoFar = computed(() => {
  if (!shift.value || typeof endForm.endOdometerMi !== 'number') return null
  return endForm.endOdometerMi - shift.value.startOdometerMi
})
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold text-highlighted">My day</h1>

    <!-- Sign on: truck, pre-trip inspection, begin mileage -->
    <UCard v-if="shiftData && !shift">
      <template #header>
        <h2 class="font-semibold text-highlighted">Start your day</h2>
        <p class="text-sm text-muted mt-1">Pick your truck, run the pre-trip and enter your beginning mileage — load actions unlock once you're signed on.</p>
      </template>
      <form class="space-y-4" @submit.prevent="startShift">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Truck" required>
            <USelect v-model="startForm.vehicleId" :items="truckItems" placeholder="Pick your truck" class="w-full" />
          </UFormField>
          <UFormField label="Beginning mileage (mi)" required>
            <UInput v-model.number="startForm.startOdometerMi" type="number" min="0" class="w-full" required @input="mileageEdited = true" />
          </UFormField>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-highlighted">Pre-trip inspection</p>
            <UButton v-if="!allChecked" size="xs" variant="ghost" color="neutral" @click="checkAll">All good — check all</UButton>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <UCheckbox
              v-for="key in pretripKeys"
              :key="key"
              v-model="startForm.checklist[key]"
              :label="PRETRIP_ITEMS[key]"
            />
          </div>
        </div>
        <UFormField
          label="Defects / remarks"
          :hint="allChecked ? 'Optional' : 'Required — describe every unchecked item'"
        >
          <UTextarea v-model="startForm.defects" :rows="2" class="w-full" placeholder="e.g. right rear marker light out" />
        </UFormField>
        <UButton
          type="submit"
          icon="i-lucide-sunrise"
          :loading="starting"
          :disabled="!startForm.vehicleId || typeof startForm.startOdometerMi !== 'number' || needsDefects"
        >
          Start shift
        </UButton>
        <p v-if="needsDefects" class="text-xs text-warning">Describe the unchecked items in the defects box (or check them off) to start.</p>
      </form>
    </UCard>

    <!-- On duty summary + sign off -->
    <UCard v-else-if="shift">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <UIcon name="i-lucide-truck" class="size-5 text-primary" />
        <div class="flex-1 min-w-48">
          <p class="font-medium text-highlighted">
            On duty<template v-if="shiftVehicle"> — {{ VEHICLE_TYPE_LABELS[shiftVehicle.type] }} · {{ shiftVehicle.plate }}</template>
          </p>
          <p class="text-sm text-muted">
            Since {{ formatDateTime(shift.startedAt) }} · out at {{ shift.startOdometerMi.toLocaleString('en-US') }} mi
            <span v-if="shift.pretripDefects" class="text-warning"> · defects noted</span>
          </p>
        </div>
        <UButton v-if="!showEndForm" variant="outline" color="neutral" icon="i-lucide-sunset" @click="showEndForm = true">
          End shift
        </UButton>
      </div>
      <form v-if="showEndForm" class="mt-4 pt-4 border-t border-default space-y-4" @submit.prevent="endShift">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Ending mileage (mi)" required :hint="milesSoFar != null && milesSoFar >= 0 ? `${milesSoFar.toLocaleString('en-US')} mi driven` : undefined">
            <UInput v-model.number="endForm.endOdometerMi" type="number" :min="shift.startOdometerMi" class="w-full" required />
          </UFormField>
          <UFormField label="Fuel used (gallons)" required>
            <UInput v-model.number="endForm.fuelGallons" type="number" min="0" step="any" class="w-full" required />
          </UFormField>
        </div>
        <div class="flex gap-2">
          <UButton type="submit" color="primary" icon="i-lucide-check" :loading="ending">Sign off</UButton>
          <UButton variant="ghost" color="neutral" @click="showEndForm = false; endShiftThenLogout = false">Not yet</UButton>
        </div>
      </form>
    </UCard>

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
                <span class="text-muted font-normal tabular-nums mr-1">#{{ formatLoadNumber(load.loadNumber) }}</span>
                {{ load.pickupCity }}, {{ load.pickupState }}
                <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
                {{ load.deliveryCity }}, {{ load.deliveryState }}
              </p>
              <p class="text-sm text-muted mt-0.5">
                {{ MATERIAL_TYPE_LABELS[load.materialType] }} · {{ formatWeight(load.weightLbs) }}
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
