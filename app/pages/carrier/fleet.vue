<script setup lang="ts">
import { VEHICLE_STATUSES, VEHICLE_TYPES } from '#shared/types'
import type { VehicleStatus, VehicleType } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Fleet — 3PL Market' })

const toast = useToast()
const { data, refresh } = await useFetch('/api/fleet/vehicles')

const showForm = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  type: 'flatbed' as VehicleType,
  plate: '',
  capacityLbs: null as number | null,
  status: 'active' as VehicleStatus,
  notes: '',
  insurancePolicy: '',
  insuranceExpiresAt: '',
  nextServiceDueAt: '',
  odometerMi: null as number | null,
})
const acting = ref(false)

const typeItems = VEHICLE_TYPES.map(t => ({ label: VEHICLE_TYPE_LABELS[t], value: t }))
const statusItems = VEHICLE_STATUSES.map(s => ({ label: s, value: s }))

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  maintenance: 'warning',
  inactive: 'neutral',
}

const toDateField = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '')

/** Badge state for a due date: expired / due within 30 days / fine. */
function dueBadge(value: string | null): { color: 'error' | 'warning', label: string } | null {
  if (!value) return null
  const days = Math.floor((new Date(value).getTime() - Date.now()) / 86400_000)
  if (days < 0) return { color: 'error', label: 'overdue' }
  if (days <= 30) return { color: 'warning', label: `${days}d left` }
  return null
}

function startCreate() {
  editingId.value = null
  Object.assign(form, {
    type: 'flatbed',
    plate: '',
    capacityLbs: null,
    status: 'active',
    notes: '',
    insurancePolicy: '',
    insuranceExpiresAt: '',
    nextServiceDueAt: '',
    odometerMi: null,
  })
  showForm.value = true
}

function startEdit(vehicle: NonNullable<typeof data.value>['vehicles'][number]) {
  editingId.value = vehicle.id
  Object.assign(form, {
    type: vehicle.type,
    plate: vehicle.plate,
    capacityLbs: vehicle.capacityLbs,
    status: vehicle.status,
    notes: vehicle.notes ?? '',
    insurancePolicy: vehicle.insurancePolicy ?? '',
    insuranceExpiresAt: toDateField(vehicle.insuranceExpiresAt),
    nextServiceDueAt: toDateField(vehicle.nextServiceDueAt),
    odometerMi: vehicle.odometerMi,
  })
  showForm.value = true
}

async function submit() {
  acting.value = true
  try {
    const base = {
      type: form.type,
      plate: form.plate,
      capacityLbs: form.capacityLbs,
      status: form.status,
    }
    if (editingId.value) {
      await $fetch(`/api/fleet/vehicles/${editingId.value}`, {
        method: 'PATCH',
        body: {
          ...base,
          notes: form.notes || null,
          insurancePolicy: form.insurancePolicy || null,
          insuranceExpiresAt: form.insuranceExpiresAt || null,
          nextServiceDueAt: form.nextServiceDueAt || null,
          // A cleared number input holds '' — treat anything non-numeric as clearing.
          odometerMi: typeof form.odometerMi === 'number' ? form.odometerMi : null,
        },
      })
    }
    else {
      await $fetch('/api/fleet/vehicles', {
        method: 'POST',
        body: {
          ...base,
          notes: form.notes || undefined,
          insurancePolicy: form.insurancePolicy || undefined,
          insuranceExpiresAt: form.insuranceExpiresAt || undefined,
          nextServiceDueAt: form.nextServiceDueAt || undefined,
          odometerMi: typeof form.odometerMi === 'number' ? form.odometerMi : undefined,
        },
      })
    }
    showForm.value = false
    await refresh()
    toast.add({ title: editingId.value ? 'Vehicle updated' : 'Vehicle added', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    acting.value = false
  }
}

async function remove(id: string) {
  try {
    await $fetch(`/api/fleet/vehicles/${id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Vehicle deleted', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

// ── Maintenance log (per-vehicle expand) ────────────────────────────────────
const openLogVehicle = ref<string | null>(null)
const logs = ref<{ id: string, performedAt: string, description: string, costCents: number | null, odometerMi: number | null }[]>([])
const logForm = reactive({ performedAt: new Date().toISOString().slice(0, 10), description: '', cost: null as number | null, odometerMi: null as number | null })
const logActing = ref(false)

async function toggleLogs(vehicleId: string) {
  if (openLogVehicle.value === vehicleId) {
    openLogVehicle.value = null
    return
  }
  openLogVehicle.value = vehicleId
  logs.value = []
  const res = await $fetch(`/api/fleet/vehicles/${vehicleId}/maintenance`)
  logs.value = res.logs
}

async function addLog() {
  if (!openLogVehicle.value) return
  logActing.value = true
  try {
    await $fetch(`/api/fleet/vehicles/${openLogVehicle.value}/maintenance`, {
      method: 'POST',
      body: {
        performedAt: logForm.performedAt,
        description: logForm.description,
        costCents: typeof logForm.cost === 'number' ? Math.round(logForm.cost * 100) : undefined,
        odometerMi: typeof logForm.odometerMi === 'number' ? logForm.odometerMi : undefined,
      },
    })
    const res = await $fetch(`/api/fleet/vehicles/${openLogVehicle.value}/maintenance`)
    logs.value = res.logs
    Object.assign(logForm, { description: '', cost: null, odometerMi: null })
    await refresh()
    toast.add({ title: 'Maintenance logged', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    logActing.value = false
  }
}

async function removeLog(logId: string) {
  try {
    await $fetch(`/api/fleet/maintenance/${logId}`, { method: 'DELETE' })
    logs.value = logs.value.filter(l => l.id !== logId)
    toast.add({ title: 'Entry removed', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="text-xl font-bold text-highlighted">Fleet</h1>
      <UButton icon="i-lucide-plus" @click="startCreate">Add vehicle</UButton>
    </div>

    <UCard v-if="showForm" class="mb-6">
      <template #header>
        <h2 class="font-semibold text-highlighted">{{ editingId ? 'Edit vehicle' : 'Add vehicle' }}</h2>
      </template>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
        <UFormField label="Type" required>
          <USelect v-model="form.type" :items="typeItems" class="w-full" />
        </UFormField>
        <UFormField label="Plate" required>
          <UInput v-model="form.plate" class="w-full" required />
        </UFormField>
        <UFormField label="Capacity (lbs)" required>
          <UInput v-model.number="form.capacityLbs" type="number" min="1" class="w-full" required />
        </UFormField>
        <UFormField label="Status" required>
          <USelect v-model="form.status" :items="statusItems" class="w-full" />
        </UFormField>
        <UFormField label="Insurance policy #">
          <UInput v-model="form.insurancePolicy" class="w-full" />
        </UFormField>
        <UFormField label="Insurance expires">
          <UInput v-model="form.insuranceExpiresAt" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Next service due">
          <UInput v-model="form.nextServiceDueAt" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Odometer (mi)">
          <UInput v-model.number="form.odometerMi" type="number" min="0" class="w-full" />
        </UFormField>
        <UFormField label="Notes" class="sm:col-span-2">
          <UInput v-model="form.notes" class="w-full" />
        </UFormField>
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" :loading="acting">{{ editingId ? 'Save' : 'Add vehicle' }}</UButton>
          <UButton variant="ghost" color="neutral" @click="showForm = false">Cancel</UButton>
        </div>
      </form>
    </UCard>

    <UCard v-if="!data?.vehicles?.length" class="text-center py-10">
      <UIcon name="i-lucide-bus-front" class="size-10 text-muted mx-auto" />
      <p class="mt-3 font-medium text-highlighted">No vehicles yet</p>
      <p class="text-sm text-muted">Add your trucks so you can attach them to loads.</p>
    </UCard>

    <div v-else class="space-y-3">
      <UCard v-for="vehicle in data?.vehicles" :key="vehicle.id">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="flex-1 min-w-48">
            <p class="font-medium text-highlighted">{{ VEHICLE_TYPE_LABELS[vehicle.type] }} · {{ vehicle.plate }}</p>
            <p class="text-sm text-muted mt-0.5">
              Capacity {{ formatWeight(vehicle.capacityLbs) }}
              <span v-if="vehicle.odometerMi != null"> · {{ vehicle.odometerMi.toLocaleString('en-US') }} mi</span>
              <span v-if="vehicle.notes"> · {{ vehicle.notes }}</span>
            </p>
            <p class="text-sm text-muted mt-0.5 flex flex-wrap items-center gap-1.5">
              <template v-if="vehicle.insuranceExpiresAt">
                <UIcon name="i-lucide-shield-check" class="size-3.5" />
                Insurance to {{ formatDate(vehicle.insuranceExpiresAt) }}
                <UBadge v-if="dueBadge(vehicle.insuranceExpiresAt)" :color="dueBadge(vehicle.insuranceExpiresAt)!.color" variant="subtle" size="sm">
                  {{ dueBadge(vehicle.insuranceExpiresAt)!.label }}
                </UBadge>
              </template>
              <template v-if="vehicle.nextServiceDueAt">
                <UIcon name="i-lucide-wrench" class="size-3.5 ml-1" />
                Service due {{ formatDate(vehicle.nextServiceDueAt) }}
                <UBadge v-if="dueBadge(vehicle.nextServiceDueAt)" :color="dueBadge(vehicle.nextServiceDueAt)!.color" variant="subtle" size="sm">
                  {{ dueBadge(vehicle.nextServiceDueAt)!.label }}
                </UBadge>
              </template>
            </p>
          </div>
          <UBadge :color="STATUS_COLORS[vehicle.status] ?? 'neutral'" variant="subtle">{{ vehicle.status }}</UBadge>
          <div class="flex gap-1">
            <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-wrench" title="Maintenance log" @click="toggleLogs(vehicle.id)" />
            <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="startEdit(vehicle)" />
            <UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash-2" @click="remove(vehicle.id)" />
          </div>
        </div>

        <div v-if="openLogVehicle === vehicle.id" class="mt-4 pt-4 border-t border-default">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Maintenance log</p>
          <p v-if="!logs.length" class="text-sm text-muted mb-3">No entries yet.</p>
          <div v-else class="space-y-1.5 mb-3">
            <div v-for="log in logs" :key="log.id" class="flex items-center justify-between gap-3 text-sm rounded border border-default px-3 py-1.5">
              <span>
                <span class="text-muted tabular-nums">{{ formatDate(log.performedAt) }}</span>
                · {{ log.description }}
                <span v-if="log.odometerMi != null" class="text-muted"> · {{ log.odometerMi.toLocaleString('en-US') }} mi</span>
              </span>
              <span class="flex items-center gap-2 shrink-0">
                <span v-if="log.costCents != null" class="tabular-nums font-medium">{{ formatCents(log.costCents) }}</span>
                <UButton size="xs" variant="ghost" color="error" icon="i-lucide-x" @click="removeLog(log.id)" />
              </span>
            </div>
          </div>
          <form class="flex flex-wrap items-end gap-2" @submit.prevent="addLog">
            <UFormField label="Date" size="sm">
              <UInput v-model="logForm.performedAt" type="date" size="sm" required />
            </UFormField>
            <UFormField label="Work done" size="sm" class="flex-1 min-w-40">
              <UInput v-model="logForm.description" size="sm" placeholder="Oil change, brake pads…" class="w-full" required />
            </UFormField>
            <UFormField label="Cost ($)" size="sm">
              <UInput v-model.number="logForm.cost" type="number" min="0" step="0.01" size="sm" class="w-24" />
            </UFormField>
            <UFormField label="Odometer (mi)" size="sm">
              <UInput v-model.number="logForm.odometerMi" type="number" min="0" size="sm" class="w-28" />
            </UFormField>
            <UButton type="submit" size="sm" :loading="logActing">Log</UButton>
          </form>
        </div>
      </UCard>
    </div>
  </div>
</template>
