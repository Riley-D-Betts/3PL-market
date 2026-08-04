<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['shipper'] } })
useSeoMeta({ title: 'Settings — 3PL Market' })

const toast = useToast()

const { data: me, refresh: refreshMe } = await useFetch('/api/auth/me')
const { data: blockData, refresh: refreshBlocks } = await useFetch('/api/shipper/blocks')

const billingEmail = ref('')
watch(me, (value) => {
  billingEmail.value = value?.user?.billingEmail ?? ''
}, { immediate: true })

const savingEmail = ref(false)

async function saveBillingEmail(clear = false) {
  savingEmail.value = true
  try {
    await $fetch('/api/shipper/profile', {
      method: 'PATCH',
      body: { billingEmail: clear || !billingEmail.value.trim() ? null : billingEmail.value.trim() },
    })
    await refreshMe()
    toast.add({ title: clear ? 'Invoicing email cleared' : 'Invoicing email saved', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    savingEmail.value = false
  }
}

async function unblock(companyId: string, companyName: string) {
  try {
    await $fetch(`/api/shipper/blocks/${companyId}`, { method: 'DELETE' })
    await refreshBlocks()
    toast.add({ title: `${companyName} unblocked`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <h1 class="text-xl font-bold text-highlighted">Settings</h1>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">Invoicing</h2>
        <p class="text-sm text-muted mt-1">
          Carriers hauling your loads see this address as "send invoices to".
          Your account email ({{ me?.user?.email }}) is used when empty.
        </p>
      </template>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="saveBillingEmail(false)">
        <UFormField label="Invoicing email" class="flex-1 min-w-56">
          <UInput v-model="billingEmail" type="email" placeholder="ap@yourcompany.com" class="w-full" />
        </UFormField>
        <div class="flex gap-2">
          <UButton type="submit" :loading="savingEmail">Save</UButton>
          <UButton
            v-if="me?.user?.billingEmail"
            variant="outline"
            color="neutral"
            :loading="savingEmail"
            @click="saveBillingEmail(true)"
          >
            Clear
          </UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">Blocked carriers</h2>
        <p class="text-sm text-muted mt-1">
          Blocked carriers cannot see your loads on the board, bid on them, or accept them.
          You can block a carrier from any bid it places on your loads.
        </p>
      </template>

      <p v-if="!blockData?.blocks?.length" class="text-sm text-muted py-2">
        No blocked carriers.
      </p>
      <div v-else class="space-y-2">
        <div
          v-for="block in blockData.blocks"
          :key="block.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-3"
        >
          <div>
            <p class="font-medium text-highlighted">{{ block.companyName }}</p>
            <p class="text-sm text-muted">
              Blocked {{ formatDate(block.createdAt) }}<span v-if="block.reason"> · {{ block.reason }}</span>
            </p>
          </div>
          <UButton size="sm" variant="outline" color="neutral" @click="unblock(block.companyId, block.companyName)">
            Unblock
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
