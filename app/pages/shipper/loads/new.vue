<script setup lang="ts">
import { MATERIAL_TYPES } from '#shared/types'
import type { MaterialType } from '#shared/types'

definePageMeta({ layout: 'dashboard', auth: { roles: ['shipper'] } })
useSeoMeta({ title: 'Post a load — 3PL Market' })

const state = reactive({
  pickupLocationName: '',
  pickupAddress: '',
  pickupCity: '',
  pickupState: '',
  jobName: '',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryState: '',
  materialType: 'aggregate' as MaterialType,
  materialDescription: '',
  weightLbs: null as number | null,
  quantity: '',
  notes: '',
  trucksRequested: 1,
  pickupWindowStart: '',
  pickupWindowEnd: '',
  travelTimeAllowanceMin: null as number | null,
  askingPrice: null as number | null,
  pickupContactName: '',
  pickupContactPhone: '',
  deliveryContactName: '',
  deliveryContactPhone: '',
})
const pending = ref(false)
const error = ref<string | null>(null)
const formEl = ref<HTMLFormElement | null>(null)

// Google Maps pins dropped into the address fields become exact coordinates.
const pickupPin = usePinnedAddress(toRef(state, 'pickupAddress'))
const deliveryPin = usePinnedAddress(toRef(state, 'deliveryAddress'))

const materialItems = MATERIAL_TYPES.map(m => ({ label: MATERIAL_TYPE_LABELS[m], value: m }))

async function submit(post: boolean) {
  // "Save as draft" comes from a type=button click, which skips native form
  // validation — run it explicitly so drafts get the same field checks.
  if (!post && formEl.value && !formEl.value.reportValidity()) return
  error.value = null
  pending.value = true
  try {
    const { load, loads: created } = await $fetch('/api/loads', {
      method: 'POST',
      body: {
        pickupLocationName: state.pickupLocationName || undefined,
        pickupAddress: state.pickupAddress,
        pickupCity: state.pickupCity,
        pickupState: state.pickupState,
        jobName: state.jobName || undefined,
        deliveryAddress: state.deliveryAddress,
        deliveryCity: state.deliveryCity,
        deliveryState: state.deliveryState,
        pickupLat: pickupPin?.value?.lat,
        pickupLng: pickupPin?.value?.lng,
        deliveryLat: deliveryPin?.value?.lat,
        deliveryLng: deliveryPin?.value?.lng,
        materialType: state.materialType,
        materialDescription: state.materialDescription || undefined,
        weightLbs: state.weightLbs,
        quantity: state.quantity || undefined,
        notes: state.notes || undefined,
        trucksRequested: state.trucksRequested || 1,
        pickupWindowStart: state.pickupWindowStart ? new Date(state.pickupWindowStart).toISOString() : undefined,
        pickupWindowEnd: state.pickupWindowEnd ? new Date(state.pickupWindowEnd).toISOString() : undefined,
        // A cleared number input holds '' (not null) — typeof guard treats it as absent.
        travelTimeAllowanceMin: typeof state.travelTimeAllowanceMin === 'number' ? state.travelTimeAllowanceMin : undefined,
        askingPriceCents: state.askingPrice != null ? Math.round(state.askingPrice * 100) : undefined,
        pickupContactName: state.pickupContactName || undefined,
        pickupContactPhone: state.pickupContactPhone || undefined,
        deliveryContactName: state.deliveryContactName || undefined,
        deliveryContactPhone: state.deliveryContactPhone || undefined,
        post,
      },
    })
    // A multi-truck request lands on the list, a single load on its page.
    await navigateTo(created.length > 1 ? '/shipper' : `/shipper/loads/${load.id}`)
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
          <p class="text-sm text-muted mt-1">Tip: drag a Google Maps pin (or paste its link) into an address field to set the exact spot.</p>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Pickup location name" hint="What the site calls it" class="sm:col-span-2">
            <UInput v-model="state.pickupLocationName" placeholder="Pit 4 — Locust Grove yard" class="w-full" />
          </UFormField>
          <UFormField label="Pickup address" required class="sm:col-span-2">
            <UInput v-model="state.pickupAddress" placeholder="Street address, gate, dock — or a dropped pin" class="w-full" required />
            <p v-if="pickupPin" class="text-xs text-success mt-1">
              <UIcon name="i-lucide-map-pin" class="size-3 inline" /> Pin captured — {{ pickupPin.lat.toFixed(5) }}, {{ pickupPin.lng.toFixed(5) }}
            </p>
          </UFormField>
          <UFormField label="Pickup city" required>
            <UInput v-model="state.pickupCity" class="w-full" required />
          </UFormField>
          <UFormField label="Pickup state" required>
            <UInput v-model="state.pickupState" placeholder="ID" class="w-full" required />
          </UFormField>
          <UFormField label="Job name" hint="The project this delivers to" class="sm:col-span-2">
            <UInput v-model="state.jobName" placeholder="Costco site — Meridian" class="w-full" />
          </UFormField>
          <UFormField label="Delivery address" required class="sm:col-span-2">
            <UInput v-model="state.deliveryAddress" class="w-full" required />
            <p v-if="deliveryPin" class="text-xs text-success mt-1">
              <UIcon name="i-lucide-map-pin" class="size-3 inline" /> Pin captured — {{ deliveryPin.lat.toFixed(5) }}, {{ deliveryPin.lng.toFixed(5) }}
            </p>
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
          <h2 class="font-semibold text-highlighted">On-site contacts</h2>
          <p class="text-sm text-muted mt-1">Who the driver should call at each stop. Shared with the carrier only after you award the load.</p>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Pickup contact name">
            <UInput v-model="state.pickupContactName" placeholder="Yard office — Manny" class="w-full" />
          </UFormField>
          <UFormField label="Pickup contact phone">
            <UInput v-model="state.pickupContactPhone" type="tel" class="w-full" />
          </UFormField>
          <UFormField label="Delivery contact name">
            <UInput v-model="state.deliveryContactName" placeholder="Site super — Kara" class="w-full" />
          </UFormField>
          <UFormField label="Delivery contact phone">
            <UInput v-model="state.deliveryContactPhone" type="tel" class="w-full" />
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
          <UFormField label="Weight (lbs)" required hint="Per truck">
            <UInput v-model.number="state.weightLbs" type="number" min="1" class="w-full" required />
          </UFormField>
          <UFormField label="Quantity" hint="e.g. 12 pallets, 18 beams">
            <UInput v-model="state.quantity" class="w-full" />
          </UFormField>
          <UFormField label="Description">
            <UInput v-model="state.materialDescription" class="w-full" />
          </UFormField>
          <UFormField label="Notes / instructions" hint="Gates, tarps, scale tickets, site rules…" class="sm:col-span-2">
            <UTextarea v-model="state.notes" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Schedule & price</h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="First load time" required>
            <UInput v-model="state.pickupWindowStart" type="datetime-local" class="w-full" required />
          </UFormField>
          <UFormField label="Last load time" required>
            <UInput v-model="state.pickupWindowEnd" type="datetime-local" class="w-full" required />
          </UFormField>
          <UFormField label="Trucks requested" required hint="Posts one load per truck">
            <UInput v-model.number="state.trucksRequested" type="number" min="1" max="50" class="w-full" required />
          </UFormField>
          <UFormField label="Travel time allowance (minutes)" hint="Paid travel time built into the rate">
            <UInput v-model.number="state.travelTimeAllowanceMin" type="number" min="0" max="1440" class="w-full" />
          </UFormField>
          <UFormField label="Asking price (USD)" required hint="Per truck — carriers can accept instantly or counter-bid">
            <UInput v-model.number="state.askingPrice" type="number" min="1" step="0.01" class="w-full" required>
              <template #leading>$</template>
            </UInput>
          </UFormField>
        </div>
      </UCard>

      <UAlert v-if="error" color="error" variant="subtle" :description="error" />

      <div class="flex gap-3">
        <UButton type="submit" :loading="pending" icon="i-lucide-megaphone">
          {{ state.trucksRequested > 1 ? `Post ${state.trucksRequested} loads to board` : 'Post to board' }}
        </UButton>
        <UButton variant="outline" color="neutral" :loading="pending" @click="submit(false)">Save as draft</UButton>
      </div>
    </form>
  </div>
</template>
