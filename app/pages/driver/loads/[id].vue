<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['driver'] } })
useSeoMeta({ title: 'Load — 3PL Market' })

const route = useRoute()
const toast = useToast()
const { data, refresh, error: loadError } = await useFetch(`/api/loads/${route.params.id}`)
const load = computed(() => data.value?.load)
const acting = ref(false)

async function act(path: 'pickup' | 'deliver', success: string) {
  acting.value = true
  try {
    await $fetch(`/api/driver/loads/${route.params.id}/${path}`, { method: 'POST' })
    await refresh()
    toast.add({ title: success, color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    acting.value = false
  }
}
</script>

<template>
  <div v-if="loadError">
    <UAlert color="error" variant="subtle" title="Load unavailable" :description="apiErrorMessage(loadError)" />
  </div>
  <div v-else-if="load" class="space-y-6 max-w-2xl">
    <div class="flex items-center gap-3">
      <h1 class="text-xl font-bold text-highlighted">{{ load.pickupCity }} → {{ load.deliveryCity }}</h1>
      <LoadStatusBadge :status="load.status" />
    </div>

    <UCard>
      <LoadRouteSummary :load="load" />
      <div class="mt-4 pt-4 border-t border-default text-sm">
        <p class="text-xs uppercase tracking-wide text-muted">Shipper contact</p>
        <p class="font-medium text-highlighted">{{ data?.shipper?.name }}</p>
        <p v-if="data?.shipper?.phone" class="text-muted">{{ data.shipper.phone }}</p>
      </div>
    </UCard>

    <UButton
      v-if="load.status === 'awarded'"
      block
      size="xl"
      color="primary"
      icon="i-lucide-package-check"
      :loading="acting"
      @click="act('pickup', 'Marked as picked up — safe travels!')"
    >
      Mark picked up
    </UButton>
    <UButton
      v-else-if="load.status === 'picked_up'"
      block
      size="xl"
      color="success"
      icon="i-lucide-map-pin-check"
      :loading="acting"
      @click="act('deliver', 'Marked as delivered — nice work!')"
    >
      Mark delivered
    </UButton>
    <UAlert
      v-else-if="load.status === 'delivered'"
      color="success"
      variant="subtle"
      icon="i-lucide-check-circle-2"
      description="Delivered — waiting for the shipper to confirm."
    />
  </div>
</template>
