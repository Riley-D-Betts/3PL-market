<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Reports — 3PL Market' })

const toDateInput = (d: Date) => d.toISOString().slice(0, 10)

const today = new Date()
const from = ref(toDateInput(new Date(today.getTime() - 30 * 86400_000)))
const to = ref(toDateInput(today))

const query = computed(() => ({
  from: from.value ? new Date(`${from.value}T00:00:00`).toISOString() : undefined,
  // inclusive end of day
  to: to.value ? new Date(`${to.value}T23:59:59`).toISOString() : undefined,
}))

const { data, pending, error } = await useFetch('/api/carrier/reports', { query })

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const rangeSuffix = computed(() => `${from.value}_${to.value}`)

function exportDrivers() {
  downloadCsv(`drivers-report-${rangeSuffix.value}.csv`,
    ['Driver', 'Loads', 'Completed', 'Weight (lbs)', 'Revenue', 'Of which detention'],
    (data.value?.byDriver ?? []).map(r => [
      r.driverName, r.totalLoads, r.completedLoads, r.weightLbs,
      (r.revenueCents / 100).toFixed(2), (r.detentionCents / 100).toFixed(2),
    ]))
}

function exportVehicles() {
  downloadCsv(`vehicles-report-${rangeSuffix.value}.csv`,
    ['Vehicle', 'Type', 'Loads', 'Completed', 'Weight (lbs)', 'Revenue', 'Of which detention'],
    (data.value?.byVehicle ?? []).map(r => [
      r.plate, r.type, r.totalLoads, r.completedLoads, r.weightLbs,
      (r.revenueCents / 100).toFixed(2), (r.detentionCents / 100).toFixed(2),
    ]))
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-highlighted">Reports</h1>
      <div class="flex items-center gap-2">
        <UFormField label="From" size="sm">
          <UInput v-model="from" type="date" size="sm" />
        </UFormField>
        <UFormField label="To" size="sm">
          <UInput v-model="to" type="date" size="sm" />
        </UFormField>
      </div>
    </div>

    <UAlert v-if="error" color="warning" variant="subtle" :description="apiErrorMessage(error)" />

    <template v-else-if="data">
      <p class="text-sm text-muted -mt-2">
        Loads whose pickup window opened in the range. Revenue counts delivered and confirmed loads only, including detention.
      </p>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UCard>
          <p class="text-sm text-muted">Loads</p>
          <p class="text-3xl font-bold text-highlighted mt-1">{{ data.totals.totalLoads }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">Completed</p>
          <p class="text-3xl font-bold text-highlighted mt-1">{{ data.totals.completedLoads }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">Revenue</p>
          <p class="text-3xl font-bold text-highlighted mt-1 tabular-nums">{{ formatCents(data.totals.revenueCents) }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">Detention earned</p>
          <p class="text-3xl font-bold text-highlighted mt-1 tabular-nums">{{ formatCents(data.totals.detentionCents) }}</p>
        </UCard>
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-highlighted">By driver</h2>
            <UButton size="sm" variant="soft" icon="i-lucide-download" :disabled="!data.byDriver.length" @click="exportDrivers">
              CSV
            </UButton>
          </div>
        </template>
        <p v-if="!data.byDriver.length" class="p-4 text-sm text-muted">No driver activity in this range.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs uppercase tracking-wide text-muted">
                <th class="px-4 py-2 font-medium">Driver</th>
                <th class="px-4 py-2 font-medium text-right">Loads</th>
                <th class="px-4 py-2 font-medium text-right">Completed</th>
                <th class="px-4 py-2 font-medium text-right">Weight</th>
                <th class="px-4 py-2 font-medium text-right">Revenue</th>
                <th class="px-4 py-2 font-medium text-right">Of which detention</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.byDriver" :key="row.driverId ?? row.driverName" class="border-b border-default last:border-b-0">
                <td class="px-4 py-2 font-medium text-highlighted">{{ row.driverName }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ row.totalLoads }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ row.completedLoads }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatWeight(row.weightLbs) }}</td>
                <td class="px-4 py-2 text-right tabular-nums font-medium text-highlighted">{{ formatCents(row.revenueCents) }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatCents(row.detentionCents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-highlighted">By vehicle</h2>
            <UButton size="sm" variant="soft" icon="i-lucide-download" :disabled="!data.byVehicle.length" @click="exportVehicles">
              CSV
            </UButton>
          </div>
        </template>
        <p v-if="!data.byVehicle.length" class="p-4 text-sm text-muted">No vehicle activity in this range (loads without an attached vehicle are not listed here).</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs uppercase tracking-wide text-muted">
                <th class="px-4 py-2 font-medium">Vehicle</th>
                <th class="px-4 py-2 font-medium text-right">Loads</th>
                <th class="px-4 py-2 font-medium text-right">Completed</th>
                <th class="px-4 py-2 font-medium text-right">Weight</th>
                <th class="px-4 py-2 font-medium text-right">Revenue</th>
                <th class="px-4 py-2 font-medium text-right">Of which detention</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.byVehicle" :key="row.vehicleId ?? row.plate" class="border-b border-default last:border-b-0">
                <td class="px-4 py-2 font-medium text-highlighted">
                  {{ row.plate }} <span class="text-muted font-normal">· {{ VEHICLE_TYPE_LABELS[row.type] }}</span>
                </td>
                <td class="px-4 py-2 text-right tabular-nums">{{ row.totalLoads }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ row.completedLoads }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatWeight(row.weightLbs) }}</td>
                <td class="px-4 py-2 text-right tabular-nums font-medium text-highlighted">{{ formatCents(row.revenueCents) }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatCents(row.detentionCents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>

    <div v-else-if="pending" class="py-16 text-center text-muted">Loading…</div>
  </div>
</template>
