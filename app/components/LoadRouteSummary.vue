<script setup lang="ts">
interface RouteLoad {
  pickupAddress: string
  pickupCity: string
  pickupState: string
  deliveryAddress: string
  deliveryCity: string
  deliveryState: string
  pickupWindowStart: string | Date
  pickupWindowEnd: string | Date
  materialType: string
  materialDescription?: string | null
  weightKg: number
  quantity?: string | null
}

defineProps<{ load: RouteLoad }>()
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="flex gap-3">
      <UIcon name="i-lucide-circle-arrow-up" class="size-5 text-primary mt-0.5 shrink-0" />
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Pickup</p>
        <p class="font-medium text-highlighted">{{ load.pickupCity }}, {{ load.pickupState }}</p>
        <p class="text-sm text-muted">{{ load.pickupAddress }}</p>
        <p class="text-sm text-muted mt-1">
          {{ formatDateTime(load.pickupWindowStart) }} → {{ formatDateTime(load.pickupWindowEnd) }}
        </p>
      </div>
    </div>
    <div class="flex gap-3">
      <UIcon name="i-lucide-circle-arrow-down" class="size-5 text-success mt-0.5 shrink-0" />
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Delivery</p>
        <p class="font-medium text-highlighted">{{ load.deliveryCity }}, {{ load.deliveryState }}</p>
        <p class="text-sm text-muted">{{ load.deliveryAddress }}</p>
      </div>
    </div>
    <div class="flex gap-3 sm:col-span-2">
      <UIcon name="i-lucide-package" class="size-5 text-muted mt-0.5 shrink-0" />
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">Cargo</p>
        <p class="font-medium text-highlighted">
          {{ MATERIAL_TYPE_LABELS[load.materialType as keyof typeof MATERIAL_TYPE_LABELS] ?? load.materialType }}
          · {{ formatWeight(load.weightKg) }}<span v-if="load.quantity"> · {{ load.quantity }}</span>
        </p>
        <p v-if="load.materialDescription" class="text-sm text-muted">{{ load.materialDescription }}</p>
      </div>
    </div>
  </div>
</template>
