<script setup lang="ts">
import { MATERIAL_TYPES } from '#shared/types'
import type { MaterialType } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['shipper'] } })
useSeoMeta({ title: 'Post a load — 3PL Market' })

const state = reactive({
  pickupAddress: '',
  pickupCity: '',
  pickupState: '',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryState: '',
  materialType: 'aggregate' as MaterialType,
  materialDescription: '',
  weightKg: null as number | null,
  quantity: '',
  pickupWindowStart: '',
  pickupWindowEnd: '',
  askingPrice: null as number | null,
})
const pending = ref(false)
const error = ref<string | null>(null)
const formEl = ref<HTMLFormElement | null>(null)

const materialItems = MATERIAL_TYPES.map(m => ({ label: MATERIAL_TYPE_LABELS[m], value: m }))

async function submit(post: boolean) {
  // "Save as draft" comes from a type=button click, which skips native form
  // validation — run it explicitly so drafts get the same field checks.
  if (!post && formEl.value && !formEl.value.reportValidity()) return
  error.value = null
  pending.value = true
  try {
    const { load } = await $fetch('/api/loads', {
      method: 'POST',
      body: {
        pickupAddress: state.pickupAddress,
        pickupCity: state.pickupCity,
        pickupState: state.pickupState,
        deliveryAddress: state.deliveryAddress,
        deliveryCity: state.deliveryCity,
        deliveryState: state.deliveryState,
        materialType: state.materialType,
        materialDescription: state.materialDescription || undefined,
        weightKg: state.weightKg,
        quantity: state.quantity || undefined,
        pickupWindowStart: state.pickupWindowStart ? new Date(state.pickupWindowStart).toISOString() : undefined,
        pickupWindowEnd: state.pickupWindowEnd ? new Date(state.pickupWindowEnd).toISOString() : undefined,
        askingPriceCents: state.askingPrice != null ? Math.round(state.askingPrice * 100) : undefined,
        post,
      },
    })
    await navigateTo(`/shipper/loads/${load.id}`)
  }
  catch (err) {
    error.value = apiErrorMessage(err)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-xl font-bold text-highlighted mb-6">Post a load</h1>
    <form ref="formEl" class="space-y-6" @submit.prevent="submit(true)">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Route</h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Pickup address" required class="sm:col-span-2">
            <UInput v-model="state.pickupAddress" placeholder="Street address, gate, dock…" class="w-full" required />
          </UFormField>
          <UFormField label="Pickup city" required>
            <UInput v-model="state.pickupCity" class="w-full" required />
          </UFormField>
          <UFormField label="Pickup state" required>
            <UInput v-model="state.pickupState" placeholder="ID" class="w-full" required />
          </UFormField>
          <UFormField label="Delivery address" required class="sm:col-span-2">
            <UInput v-model="state.deliveryAddress" class="w-full" required />
          </UFormField>
          <UFormField label="Delivery city" required>
            <UInput v-model="state.deliveryCity" class="w-full" required />
          </UFormField>
          <UFormField label="Delivery state" required>
            <UInput v-model="state.deliveryState" class="w-full" required />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Cargo</h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Material" required>
            <USelect v-model="state.materialType" :items="materialItems" class="w-full" />
          </UFormField>
          <UFormField label="Weight (kg)" required>
            <UInput v-model.number="state.weightKg" type="number" min="1" class="w-full" required />
          </UFormField>
          <UFormField label="Quantity" hint="e.g. 12 pallets, 18 beams">
            <UInput v-model="state.quantity" class="w-full" />
          </UFormField>
          <UFormField label="Description">
            <UInput v-model="state.materialDescription" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Schedule & price</h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Pickup window opens" required>
            <UInput v-model="state.pickupWindowStart" type="datetime-local" class="w-full" required />
          </UFormField>
          <UFormField label="Pickup window closes" required>
            <UInput v-model="state.pickupWindowEnd" type="datetime-local" class="w-full" required />
          </UFormField>
          <UFormField label="Asking price (USD)" required hint="Carriers can accept this instantly or counter-bid">
            <UInput v-model.number="state.askingPrice" type="number" min="1" step="0.01" class="w-full" required>
              <template #leading>$</template>
            </UInput>
          </UFormField>
        </div>
      </UCard>

      <UAlert v-if="error" color="error" variant="subtle" :description="error" />

      <div class="flex gap-3">
        <UButton type="submit" :loading="pending" icon="i-lucide-megaphone">Post to board</UButton>
        <UButton variant="outline" color="neutral" :loading="pending" @click="submit(false)">Save as draft</UButton>
      </div>
    </form>
  </div>
</template>
