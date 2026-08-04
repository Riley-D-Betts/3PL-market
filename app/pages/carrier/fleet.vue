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
  capacityKg: null as number | null,
  status: 'active' as VehicleStatus,
  notes: '',
})
const acting = ref(false)

const typeItems = VEHICLE_TYPES.map(t => ({ label: VEHICLE_TYPE_LABELS[t], value: t }))
const statusItems = VEHICLE_STATUSES.map(s => ({ label: s, value: s }))

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  maintenance: 'warning',
  inactive: 'neutral',
}

function startCreate() {
  editingId.value = null
  Object.assign(form, { type: 'flatbed', plate: '', capacityKg: null, status: 'active', notes: '' })
  showForm.value = true
}

function startEdit(vehicle: { id: string, type: string, plate: string, capacityKg: number, status: string, notes: string | null }) {
  editingId.value = vehicle.id
  Object.assign(form, {
    type: vehicle.type,
    plate: vehicle.plate,
    capacityKg: vehicle.capacityKg,
    status: vehicle.status,
    notes: vehicle.notes ?? '',
  })
  showForm.value = true
}

async function submit() {
  acting.value = true
  try {
    const base = {
      type: form.type,
      plate: form.plate,
      capacityKg: form.capacityKg,
      status: form.status,
    }
    if (editingId.value) {
      // PATCH: null clears notes; undefined would silently keep the old value.
      await $fetch(`/api/fleet/vehicles/${editingId.value}`, {
        method: 'PATCH',
        body: { ...base, notes: form.notes || null },
      })
    }
    else {
      await $fetch('/api/fleet/vehicles', {
        method: 'POST',
        body: { ...base, notes: form.notes || undefined },
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
        <UFormField label="Capacity (kg)" required>
          <UInput v-model.number="form.capacityKg" type="number" min="1" class="w-full" required />
        </UFormField>
        <UFormField label="Status" required>
          <USelect v-model="form.status" :items="statusItems" class="w-full" />
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
              Capacity {{ formatWeight(vehicle.capacityKg) }}<span v-if="vehicle.notes"> · {{ vehicle.notes }}</span>
            </p>
          </div>
          <UBadge :color="STATUS_COLORS[vehicle.status] ?? 'neutral'" variant="subtle">{{ vehicle.status }}</UBadge>
          <div class="flex gap-1">
            <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="startEdit(vehicle)" />
            <UButton size="sm" variant="ghost" color="error" icon="i-lucide-trash-2" @click="remove(vehicle.id)" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
