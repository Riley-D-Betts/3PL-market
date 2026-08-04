<script setup lang="ts">
import type { LoadStatus } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Dispatch calendar — 3PL Market' })

const { data, error } = await useFetch('/api/carrier/loads')
const { data: driverData } = await useFetch('/api/fleet/drivers', { server: false, lazy: true })

// ── View + navigation state ─────────────────────────────────────────────────
const view = ref<'month' | 'day'>('month')
const today = new Date()
const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selectedDay = ref<Date>(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
const dayLabel = computed(() =>
  selectedDay.value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))

function shiftMonth(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function shiftDay(delta: number) {
  const d = new Date(selectedDay.value)
  d.setDate(d.getDate() + delta)
  selectedDay.value = d
  cursor.value = new Date(d.getFullYear(), d.getMonth(), 1)
}

function goToday() {
  cursor.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selectedDay.value = new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function openDayBoard(day: Date) {
  selectedDay.value = day
  view.value = 'day'
}

const weeks = computed(() => {
  const start = new Date(cursor.value)
  start.setDate(1 - start.getDay())
  const grid: Date[][] = []
  const d = new Date(start)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    grid.push(week)
  }
  return grid
})

// ── Loads placed on their pickup-window day ─────────────────────────────────
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const isSameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)
const inMonth = (d: Date) => d.getMonth() === cursor.value.getMonth()

const loadsByDay = computed(() => {
  const map = new Map<string, NonNullable<typeof data.value>['loads']>()
  for (const l of data.value?.loads ?? []) {
    if (l.status === 'cancelled') continue
    const key = dayKey(new Date(l.pickupWindowStart))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(l)
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.pickupWindowStart).getTime() - new Date(b.pickupWindowStart).getTime())
  }
  return map
})

const dayLoads = (d: Date) => loadsByDay.value.get(dayKey(d)) ?? []
const selectedLoads = computed(() => dayLoads(selectedDay.value))

const CHIP_COLORS: Record<LoadStatus, string> = {
  draft: 'bg-gray-400',
  posted: 'bg-sky-500',
  awarded: 'bg-amber-500',
  picked_up: 'bg-orange-500',
  delivered: 'bg-emerald-500',
  completed: 'bg-emerald-700',
  cancelled: 'bg-gray-400',
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold text-highlighted">Dispatch calendar</h1>
        <div class="flex rounded-md border border-default overflow-hidden">
          <button
            type="button"
            class="px-3 py-1 text-sm font-medium transition-colors"
            :class="view === 'month' ? 'bg-primary text-inverted' : 'text-muted hover:text-highlighted'"
            @click="view = 'month'"
          >
            Month
          </button>
          <button
            type="button"
            class="px-3 py-1 text-sm font-medium transition-colors"
            :class="view === 'day' ? 'bg-primary text-inverted' : 'text-muted hover:text-highlighted'"
            @click="view = 'day'"
          >
            Day
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UButton variant="ghost" color="neutral" icon="i-lucide-chevron-left" @click="view === 'month' ? shiftMonth(-1) : shiftDay(-1)" />
        <span class="font-semibold text-highlighted w-44 text-center">{{ view === 'month' ? monthLabel : dayLabel }}</span>
        <UButton variant="ghost" color="neutral" icon="i-lucide-chevron-right" @click="view === 'month' ? shiftMonth(1) : shiftDay(1)" />
        <UButton variant="outline" color="neutral" size="sm" @click="goToday">Today</UButton>
      </div>
    </div>

    <UAlert v-if="error" color="warning" variant="subtle" :description="apiErrorMessage(error)" />

    <DayScheduleBoard
      v-else-if="view === 'day'"
      :day="selectedDay"
      :loads="data?.loads ?? []"
      :drivers="driverData?.drivers ?? []"
    />

    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div class="grid grid-cols-7 border-b border-default text-center text-xs font-medium uppercase tracking-wide text-muted">
          <div v-for="d in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="d" class="py-2">{{ d }}</div>
        </div>
        <div v-for="(week, wi) in weeks" :key="wi" class="grid grid-cols-7 border-b border-default last:border-b-0">
          <button
            v-for="day in week"
            :key="day.toISOString()"
            type="button"
            class="min-h-24 border-r border-default last:border-r-0 p-1.5 text-left align-top transition-colors hover:bg-elevated"
            :class="[
              inMonth(day) ? '' : 'opacity-40',
              isSameDay(day, selectedDay) ? 'bg-primary/5 ring-1 ring-inset ring-primary' : '',
            ]"
            @click="selectedDay = day"
          >
            <span
              class="inline-flex size-6 items-center justify-center rounded-full text-xs font-medium"
              :class="isSameDay(day, today) ? 'bg-primary text-inverted' : 'text-highlighted'"
            >
              {{ day.getDate() }}
            </span>
            <div class="mt-1 space-y-0.5">
              <div
                v-for="l in dayLoads(day).slice(0, 3)"
                :key="l.id"
                class="truncate rounded px-1 py-0.5 text-[11px] font-medium text-white"
                :class="CHIP_COLORS[l.status]"
              >
                <UIcon v-if="!l.assignedDriverId && l.status === 'awarded'" name="i-lucide-alert-triangle" class="size-3 inline" />
                {{ l.pickupCity }} → {{ l.deliveryCity }}
              </div>
              <p v-if="dayLoads(day).length > 3" class="text-[11px] text-muted px-1">
                +{{ dayLoads(day).length - 3 }} more
              </p>
            </div>
          </button>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold text-highlighted">
              {{ selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }}
            </h2>
            <UButton size="sm" variant="soft" icon="i-lucide-rows-3" @click="openDayBoard(selectedDay)">
              Day board
            </UButton>
          </div>
        </template>
        <p v-if="!selectedLoads.length" class="text-sm text-muted py-2">
          Nothing scheduled — pickups land on the calendar when you win a load.
        </p>
        <div v-else class="space-y-2">
          <NuxtLink
            v-for="l in selectedLoads"
            :key="l.id"
            :to="`/carrier/loads/${l.id}`"
            class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-default p-3 hover:bg-elevated transition-colors"
          >
            <div class="w-24 shrink-0 text-sm">
              <p class="font-semibold text-highlighted tabular-nums">
                {{ new Date(l.pickupWindowStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}
              </p>
              <p class="text-xs text-muted">pickup opens</p>
            </div>
            <div class="flex-1 min-w-48">
              <p class="font-medium text-highlighted">
                {{ l.pickupCity }}, {{ l.pickupState }}
                <UIcon name="i-lucide-arrow-right" class="size-4 inline text-muted" />
                {{ l.deliveryCity }}, {{ l.deliveryState }}
              </p>
              <p class="text-sm text-muted mt-0.5">
                {{ MATERIAL_TYPE_LABELS[l.materialType] }} · {{ formatWeight(l.weightKg) }} · {{ l.shipperName }}
              </p>
            </div>
            <UBadge v-if="!l.assignedDriverId && l.status === 'awarded'" color="warning" variant="soft">
              Needs driver
            </UBadge>
            <p v-else-if="l.driverName" class="text-sm text-muted">
              <UIcon name="i-lucide-user" class="size-3.5 inline" /> {{ l.driverName }}
            </p>
            <LoadStatusBadge :status="l.status" />
          </NuxtLink>
        </div>
      </UCard>
    </template>
  </div>
</template>
