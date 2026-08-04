<script setup lang="ts">
// Printable invoice for a finished load — use the browser's Print → PDF.
definePageMeta({ layout: false, auth: { roles: ['carrier_admin'] } })
useSeoMeta({ title: 'Invoice — 3PL Market' })

const route = useRoute()
const { data, error: loadError } = await useFetch(`/api/loads/${route.params.id}`)
const { data: me } = await useFetch('/api/auth/me')

const load = computed(() => data.value?.load)
const company = computed(() => me.value?.company)

const invoiceNumber = computed(() => load.value ? `INV-${formatLoadNumber(load.value.loadNumber)}` : '')
const invoiceDate = computed(() => load.value?.invoicedAt ?? new Date().toISOString())

// Only the assigned carrier may render an invoice — the board also exposes
// posted loads, and those must not become someone else's letterhead.
const isMine = computed(() =>
  !!load.value && !!me.value?.company && load.value.assignedCompanyId === me.value.company.id)

const lineHaul = computed(() => load.value?.finalPriceCents ?? load.value?.askingPriceCents ?? null)
const hasPrice = computed(() => lineHaul.value != null)
const pickupDetention = computed(() => load.value?.pickupDetentionCents ?? 0)
const deliveryDetention = computed(() => load.value?.deliveryDetentionCents ?? 0)
const total = computed(() => (lineHaul.value ?? 0) + pickupDetention.value + deliveryDetention.value)

const billTo = computed(() => {
  if (!load.value) return null
  return {
    name: data.value?.shipper?.name ?? load.value.externalShipperName ?? 'Customer',
    email: data.value?.invoiceEmail,
    phone: data.value?.shipper?.phone ?? load.value.externalShipperPhone,
  }
})

const mailtoHref = computed(() => {
  if (!billTo.value?.email) return null
  const subject = encodeURIComponent(`Invoice ${invoiceNumber.value} from ${company.value?.name ?? 'your carrier'}`)
  return `mailto:${billTo.value.email}?subject=${subject}`
})

const finished = computed(() => load.value && ['delivered', 'completed'].includes(load.value.status))

function printPage() {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-white text-neutral-900">
    <div v-if="loadError" class="p-8">
      <UAlert color="error" variant="subtle" title="Load unavailable" :description="apiErrorMessage(loadError)" />
    </div>
    <div v-else-if="load && !isMine" class="p-8">
      <UAlert color="error" variant="subtle" title="Not your load" description="Invoices can only be generated for loads assigned to your company." />
    </div>
    <div v-else-if="load" class="max-w-3xl mx-auto p-8 print:p-0">
      <!-- Screen-only toolbar -->
      <div class="flex items-center justify-between mb-6 print:hidden">
        <UButton variant="ghost" color="neutral" icon="i-lucide-arrow-left" :to="`/carrier/loads/${load.id}`">
          Back to load
        </UButton>
        <div class="flex gap-2">
          <UButton v-if="mailtoHref" variant="outline" color="neutral" icon="i-lucide-mail" :href="mailtoHref">
            Email to {{ billTo?.email }}
          </UButton>
          <UButton icon="i-lucide-printer" @click="printPage">Print / Save PDF</UButton>
        </div>
      </div>

      <UAlert
        v-if="!finished"
        color="warning"
        variant="subtle"
        class="mb-6 print:hidden"
        description="This load isn't delivered yet — the invoice below is a preview and can't be marked sent."
      />
      <UAlert
        v-if="!hasPrice"
        color="warning"
        variant="subtle"
        class="mb-6 print:hidden"
        description="This load has no agreed price — the invoice below has no line-haul amount."
      />

      <!-- The invoice -->
      <div class="border border-neutral-300 rounded-lg p-8 print:border-0 print:p-0">
        <div class="flex items-start justify-between gap-6 pb-6 border-b border-neutral-200">
          <div>
            <h1 class="text-2xl font-bold">{{ company?.name }}</h1>
            <p class="text-sm text-neutral-600 mt-1">
              <template v-if="company?.mcNumber">{{ company.mcNumber }} · </template>{{ company?.contactEmail }}
              <template v-if="company?.contactPhone"> · {{ company.contactPhone }}</template>
            </p>
            <p v-if="company?.address" class="text-sm text-neutral-600">{{ company.address }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-xl font-bold tracking-wide">INVOICE</p>
            <p class="text-sm text-neutral-600 mt-1 tabular-nums">{{ invoiceNumber }}</p>
            <p class="text-sm text-neutral-600 tabular-nums">{{ formatDate(invoiceDate) }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6 py-6 border-b border-neutral-200 text-sm">
          <div>
            <p class="text-xs uppercase tracking-wide text-neutral-500 mb-1">Bill to</p>
            <p class="font-semibold">{{ billTo?.name }}</p>
            <p v-if="billTo?.email" class="text-neutral-600">{{ billTo.email }}</p>
            <p v-if="billTo?.phone" class="text-neutral-600">{{ billTo.phone }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-neutral-500 mb-1">Load</p>
            <p class="font-semibold tabular-nums">
              {{ formatLoadNumber(load.loadNumber) }}<template v-if="load.jobName"> — {{ load.jobName }}</template>
            </p>
            <p class="text-neutral-600">
              {{ load.pickupCity }}, {{ load.pickupState }} → {{ load.deliveryCity }}, {{ load.deliveryState }}
            </p>
            <p class="text-neutral-600">
              {{ MATERIAL_TYPE_LABELS[load.materialType as keyof typeof MATERIAL_TYPE_LABELS] ?? load.materialType }}
              · {{ formatWeight(load.weightLbs) }}<template v-if="load.deliveredTons != null"> · delivered {{ load.deliveredTons }} tons</template>
            </p>
            <p v-if="load.deliveredAt" class="text-neutral-600">Delivered {{ formatDateTime(load.deliveredAt) }}</p>
          </div>
        </div>

        <table class="w-full text-sm mt-6">
          <thead>
            <tr class="text-left text-neutral-500 border-b border-neutral-200">
              <th class="py-2 font-medium">Description</th>
              <th class="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-neutral-100">
              <td class="py-2.5">Line haul — {{ load.pickupCity }} to {{ load.deliveryCity }}</td>
              <td class="py-2.5 text-right tabular-nums">{{ formatCents(lineHaul) }}</td>
            </tr>
            <tr v-if="pickupDetention > 0" class="border-b border-neutral-100">
              <td class="py-2.5">Detention at pickup</td>
              <td class="py-2.5 text-right tabular-nums">{{ formatCents(pickupDetention) }}</td>
            </tr>
            <tr v-if="deliveryDetention > 0" class="border-b border-neutral-100">
              <td class="py-2.5">Detention at delivery</td>
              <td class="py-2.5 text-right tabular-nums">{{ formatCents(deliveryDetention) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="pt-4 font-semibold text-base">Total due</td>
              <td class="pt-4 text-right font-bold text-base tabular-nums">{{ formatCents(total) }}</td>
            </tr>
          </tfoot>
        </table>

        <p class="text-xs text-neutral-500 mt-10">
          Generated by 3PL Market for {{ company?.name }} · reference {{ invoiceNumber }} / load {{ formatLoadNumber(load.loadNumber) }}
        </p>
      </div>
    </div>
  </div>
</template>
