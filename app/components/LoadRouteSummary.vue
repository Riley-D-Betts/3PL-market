<script setup lang="ts">
interface RouteLoad {
  pickupLocationName?: string | null
  pickupAddress: string
  pickupCity: string
  pickupState: string
  jobName?: string | null
  deliveryAddress: string
  deliveryCity: string
  deliveryState: string
  pickupWindowStart: string | Date
  pickupWindowEnd: string | Date
  materialType: string
  materialDescription?: string | null
  weightLbs: number
  quantity?: string | null
  notes?: string | null
  travelTimeAllowanceMin?: number | null
  // Present only for viewers entitled to them (server nulls them otherwise).
  pickupContactName?: string | null
  pickupContactPhone?: string | null
  deliveryContactName?: string | null
  deliveryContactPhone?: string | null
}

defineProps<{ load: RouteLoad }>()
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="flex gap-3">
      <UIcon name="i-lucide-circle-arrow-up" class="size-5 text-primary mt-0.5 shrink-0" />
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Pickup</p>
        <p v-if="load.pickupLocationName" class="font-medium text-highlighted">{{ load.pickupLocationName }}</p>
        <p class="font-medium text-highlighted" :class="{ 'font-normal text-sm': load.pickupLocationName }">
          {{ load.pickupCity }}, {{ load.pickupState }}
        </p>
        <p class="text-sm text-muted">{{ load.pickupAddress }}</p>
        <p class="text-sm text-muted mt-1">
          First load {{ formatDateTime(load.pickupWindowStart) }} · last load {{ formatDateTime(load.pickupWindowEnd) }}
        </p>
        <p v-if="load.pickupContactName" class="text-sm mt-1">
          <UIcon name="i-lucide-phone" class="size-3.5 inline text-muted" />
          {{ load.pickupContactName }}<span v-if="load.pickupContactPhone" class="text-muted"> · {{ load.pickupContactPhone }}</span>
        </p>
      </div>
    </div>
    <div class="flex gap-3">
      <UIcon name="i-lucide-circle-arrow-down" class="size-5 text-success mt-0.5 shrink-0" />
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Delivery</p>
        <p v-if="load.jobName" class="font-medium text-highlighted">{{ load.jobName }}</p>
        <p class="font-medium text-highlighted" :class="{ 'font-normal text-sm': load.jobName }">
          {{ load.deliveryCity }}, {{ load.deliveryState }}
        </p>
        <p class="text-sm text-muted">{{ load.deliveryAddress }}</p>
        <p v-if="load.deliveryContactName" class="text-sm mt-1">
          <UIcon name="i-lucide-phone" class="size-3.5 inline text-muted" />
          {{ load.deliveryContactName }}<span v-if="load.deliveryContactPhone" class="text-muted"> · {{ load.deliveryContactPhone }}</span>
        </p>
      </div>
    </div>
    <div class="flex gap-3 sm:col-span-2">
      <UIcon name="i-lucide-package" class="size-5 text-muted mt-0.5 shrink-0" />
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Cargo</p>
        <p class="font-medium text-highlighted">
          {{ MATERIAL_TYPE_LABELS[load.materialType as keyof typeof MATERIAL_TYPE_LABELS] ?? load.materialType }}
          · {{ formatWeight(load.weightLbs) }}<span v-if="load.quantity"> · {{ load.quantity }}</span>
        </p>
        <p v-if="load.materialDescription" class="text-sm text-muted">{{ load.materialDescription }}</p>
        <p v-if="load.travelTimeAllowanceMin != null" class="text-sm text-muted mt-1">
          Travel time allowance: {{ formatMinutes(load.travelTimeAllowanceMin) }}
        </p>
      </div>
    </div>
    <div v-if="load.notes" class="flex gap-3 sm:col-span-2">
      <UIcon name="i-lucide-clipboard-list" class="size-5 text-warning mt-0.5 shrink-0" />
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Notes / instructions</p>
        <p class="text-sm whitespace-pre-line">{{ load.notes }}</p>
      </div>
    </div>
  </div>
</template>
