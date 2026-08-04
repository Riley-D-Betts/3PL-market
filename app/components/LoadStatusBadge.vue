<script setup lang="ts">
import type { LoadStatus } from '#shared/types'

defineProps<{ status: LoadStatus }>()
</script>

<template>
  <UBadge :color="LOAD_STATUS_COLORS[status]" variant="subtle">
    {{ LOAD_STATUS_LABELS[status] }}
  </UBadge>
</template>
