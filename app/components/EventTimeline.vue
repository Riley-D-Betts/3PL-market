<script setup lang="ts">
interface TimelineEvent {
  id: string
  eventType: string
  payload?: Record<string, unknown> | null
  createdAt: string | Date
  actorName?: string | null
}

defineProps<{ events: TimelineEvent[] }>()

const EVENT_ICONS: Record<string, string> = {
  created: 'i-lucide-file-plus',
  posted: 'i-lucide-megaphone',
  unposted: 'i-lucide-undo-2',
  bid_placed: 'i-lucide-gavel',
  bid_withdrawn: 'i-lucide-x-circle',
  awarded: 'i-lucide-badge-check',
  driver_assigned: 'i-lucide-user-check',
  arrived_pickup: 'i-lucide-map-pin',
  picked_up: 'i-lucide-package-check',
  arrived_delivery: 'i-lucide-flag',
  delivered: 'i-lucide-map-pin-check',
  completed: 'i-lucide-check-circle-2',
  cancelled: 'i-lucide-ban',
  note: 'i-lucide-sticky-note',
  invoiced: 'i-lucide-receipt',
}

function detail(event: TimelineEvent): string | null {
  const p = event.payload
  if (!p) return null
  const parts: string[] = []
  if (typeof p.amountCents === 'number') parts.push(formatCents(p.amountCents))
  if (typeof p.detentionCents === 'number' && p.detentionCents > 0) {
    parts.push(`detention ${formatCents(p.detentionCents as number)}`)
  }
  if (typeof p.invoiceNumber === 'string') parts.push(p.invoiceNumber)
  if (typeof p.note === 'string' && p.note) parts.push(p.note)
  return parts.length ? parts.join(' · ') : null
}
</script>

<template>
  <ol class="space-y-0">
    <li v-for="(event, i) in events" :key="event.id" class="flex gap-3">
      <div class="flex flex-col items-center">
        <span class="flex size-7 items-center justify-center rounded-full bg-elevated ring-1 ring-default">
          <UIcon :name="EVENT_ICONS[event.eventType] ?? 'i-lucide-circle'" class="size-4 text-muted" />
        </span>
        <span v-if="i < events.length - 1" class="w-px flex-1 bg-border my-1 min-h-4" />
      </div>
      <div class="pb-5 min-w-0">
        <p class="text-sm font-medium text-highlighted">
          {{ EVENT_TYPE_LABELS[event.eventType] ?? event.eventType }}
          <span v-if="detail(event)" class="text-muted font-normal">· {{ detail(event) }}</span>
        </p>
        <p class="text-xs text-muted">
          {{ formatDateTime(event.createdAt) }}<span v-if="event.actorName"> · {{ event.actorName }}</span>
        </p>
      </div>
    </li>
  </ol>
</template>
