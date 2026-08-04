<script setup lang="ts">
interface Attachment {
  id: string
  kind: string
  filename: string | null
  contentType: string
  createdAt: string | Date
}

const props = defineProps<{ loadId: string, attachments: Attachment[] }>()

const tickets = computed(() => props.attachments.filter(a => a.kind === 'ticket'))
</script>

<template>
  <UCard v-if="tickets.length">
    <template #header>
      <h2 class="font-semibold text-highlighted">Scale tickets</h2>
      <p class="text-sm text-muted mt-1">Uploaded by the driver at delivery.</p>
    </template>
    <div class="flex flex-wrap gap-3">
      <a
        v-for="t in tickets"
        :key="t.id"
        :href="`/api/loads/${loadId}/attachments/${t.id}`"
        target="_blank"
        rel="noopener"
        class="block group"
        :title="t.filename || 'ticket photo'"
      >
        <img
          :src="`/api/loads/${loadId}/attachments/${t.id}`"
          :alt="t.filename || 'ticket photo'"
          class="h-28 rounded-lg border border-default object-cover transition-shadow group-hover:shadow-md"
        >
        <p class="text-xs text-muted mt-1">{{ formatDateTime(t.createdAt) }}</p>
      </a>
    </div>
  </UCard>
</template>
