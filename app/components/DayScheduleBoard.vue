<script setup lang="ts">
import type { LoadStatus } from '#shared/types'

interface BoardLoad {
  id: string
  loadNumber: number
  status: LoadStatus
  pickupCity: string
  deliveryCity: string
  pickupWindowStart: string | Date
  pickupWindowEnd: string | Date
  assignedDriverId: string | null
  driverName?: string | null
  vehiclePlate?: string | null
  weightLbs: number
}

interface BoardDriver {
  id: string
  name: string
  isActive: boolean
  homeBaseCity: string | null
}

const props = defineProps<{ day: Date, loads: BoardLoad[], drivers: BoardDriver[] }>()

const BLOCK_COLORS: Record<string, string> = {
  awarded: 'bg-amber-500 hover:bg-amber-600',
  picked_up: 'bg-orange-500 hover:bg-orange-600',
  delivered: 'bg-emerald-500 hover:bg-emerald-600',
  completed: 'bg-emerald-700 hover:bg-emerald-800',
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const dayLoads = computed(() =>
  props.loads.filter(l => l.status !== 'cancelled' && sameDay(new Date(l.pickupWindowStart), props.day)))

// Hour axis: fit the day's windows with an hour of padding, minimum 8h span.
const axis = computed(() => {
  let start = 6
  let end = 18
  if (dayLoads.value.length) {
    start = Math.min(...dayLoads.value.map(l => new Date(l.pickupWindowStart).getHours())) - 1
    end = Math.max(...dayLoads.value.map(l => new Date(l.pickupWindowEnd).getHours() + 1)) + 1
  }
  start = Math.max(0, Math.min(start, 16))
  end = Math.min(24, Math.max(end, start + 8))
  return { start, end, span: end - start }
})

const hourLabels = computed(() =>
  Array.from({ length: axis.value.span + 1 }, (_, i) => {
    const h = axis.value.start + i
    return { h, label: new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' }) }
  }))

function minutesOfDay(value: string | Date): number {
  const d = new Date(value)
  return d.getHours() * 60 + d.getMinutes()
}

interface Block {
  load: BoardLoad
  leftPct: number
  widthPct: number
  subRow: number
}

/** Greedy sub-row packing so overlapping windows stack instead of colliding. */
function packBlocks(loads: BoardLoad[]): { blocks: Block[], rows: number } {
  const axisStart = axis.value.start * 60
  const axisSpan = axis.value.span * 60
  const sorted = [...loads].sort((a, b) => minutesOfDay(a.pickupWindowStart) - minutesOfDay(b.pickupWindowStart))
  const rowEnds: number[] = []
  const blocks: Block[] = []
  for (const load of sorted) {
    const start = Math.max(axisStart, minutesOfDay(load.pickupWindowStart))
    const end = Math.min(axisStart + axisSpan, Math.max(minutesOfDay(load.pickupWindowEnd), start + 30))
    let subRow = rowEnds.findIndex(e => e <= start)
    if (subRow === -1) {
      subRow = rowEnds.length
      rowEnds.push(0)
    }
    rowEnds[subRow] = end
    blocks.push({
      load,
      leftPct: ((start - axisStart) / axisSpan) * 100,
      widthPct: Math.max(((end - start) / axisSpan) * 100, 4),
      subRow,
    })
  }
  return { blocks, rows: Math.max(1, rowEnds.length) }
}

const lanes = computed(() => {
  const driverLanes = props.drivers
    .filter(d => d.isActive)
    .map(d => ({
      key: d.id,
      label: d.name,
      sublabel: d.homeBaseCity ?? '',
      ...packBlocks(dayLoads.value.filter(l => l.assignedDriverId === d.id)),
    }))
  const unassigned = dayLoads.value.filter(l => !l.assignedDriverId)
  return [
    ...(unassigned.length
      ? [{ key: 'unassigned', label: 'Unassigned', sublabel: 'needs a driver', ...packBlocks(unassigned) }]
      : []),
    ...driverLanes,
  ]
})

const isToday = computed(() => sameDay(props.day, new Date()))
const nowPct = computed(() => {
  const minutes = new Date().getHours() * 60 + new Date().getMinutes()
  const pct = ((minutes - axis.value.start * 60) / (axis.value.span * 60)) * 100
  return pct >= 0 && pct <= 100 ? pct : null
})

const timeOf = (value: string | Date) =>
  new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <div class="overflow-x-auto">
      <div class="min-w-[720px]">
        <!-- Hour axis -->
        <div class="flex border-b border-default">
          <div class="w-40 shrink-0 border-r border-default px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            Driver
          </div>
          <div class="relative flex-1 h-8">
            <span
              v-for="tick in hourLabels"
              :key="tick.h"
              class="absolute top-1.5 -translate-x-1/2 text-[11px] text-muted"
              :style="{ left: `${((tick.h - axis.start) / axis.span) * 100}%` }"
            >
              {{ tick.label }}
            </span>
          </div>
        </div>

        <p v-if="!lanes.length" class="p-6 text-sm text-muted">
          No active drivers yet — add drivers to plan their day here.
        </p>

        <div v-for="lane in lanes" :key="lane.key" class="flex border-b border-default last:border-b-0">
          <div class="w-40 shrink-0 border-r border-default px-3 py-2">
            <p class="text-sm font-medium truncate" :class="lane.key === 'unassigned' ? 'text-warning' : 'text-highlighted'">
              <UIcon v-if="lane.key === 'unassigned'" name="i-lucide-alert-triangle" class="size-3.5 inline" />
              {{ lane.label }}
            </p>
            <p v-if="lane.sublabel" class="text-xs text-muted truncate">{{ lane.sublabel }}</p>
          </div>
          <div class="relative flex-1" :style="{ height: `${lane.rows * 44 + 8}px` }">
            <!-- hour gridlines -->
            <span
              v-for="tick in hourLabels.slice(1, -1)"
              :key="tick.h"
              class="absolute inset-y-0 w-px bg-border/60"
              :style="{ left: `${((tick.h - axis.start) / axis.span) * 100}%` }"
            />
            <span
              v-if="isToday && nowPct !== null"
              class="absolute inset-y-0 w-0.5 bg-red-500 z-10"
              :style="{ left: `${nowPct}%` }"
            />
            <NuxtLink
              v-for="block in lane.blocks"
              :key="block.load.id"
              :to="`/carrier/loads/${block.load.id}`"
              class="absolute rounded-md px-2 py-1 text-white text-[11px] leading-tight overflow-hidden shadow-sm transition-colors"
              :class="BLOCK_COLORS[block.load.status] ?? 'bg-gray-500'"
              :style="{
                left: `${block.leftPct}%`,
                width: `${block.widthPct}%`,
                top: `${block.subRow * 44 + 4}px`,
                height: '40px',
              }"
              :title="`${formatLoadNumber(block.load.loadNumber)} · ${block.load.pickupCity} → ${block.load.deliveryCity} · window ${timeOf(block.load.pickupWindowStart)}–${timeOf(block.load.pickupWindowEnd)} · ${LOAD_STATUS_LABELS[block.load.status]}`"
            >
              <span class="block font-semibold truncate">{{ block.load.pickupCity }} → {{ block.load.deliveryCity }}</span>
              <span class="block truncate opacity-90">
                {{ timeOf(block.load.pickupWindowStart) }}<template v-if="block.load.vehiclePlate"> · {{ block.load.vehiclePlate }}</template>
              </span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
