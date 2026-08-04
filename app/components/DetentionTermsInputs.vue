<script setup lang="ts">
/**
 * The detention terms a carrier proposes: free wait time at each stop, then
 * an hourly rate. Bound as numbers; rate is in DOLLARS here (converted to
 * cents by the caller when posting).
 */
const freeMinutes = defineModel<number>('freeMinutes', { default: 120 })
const ratePerHour = defineModel<number>('ratePerHour', { default: 75 })
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <UFormField label="Free wait time (min)" size="sm">
      <UInput v-model.number="freeMinutes" type="number" min="0" max="1440" class="w-full" />
    </UFormField>
    <UFormField label="Detention rate ($/hr)" size="sm">
      <UInput v-model.number="ratePerHour" type="number" min="0" step="0.01" class="w-full">
        <template #leading>$</template>
      </UInput>
    </UFormField>
  </div>
</template>
