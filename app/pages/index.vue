<script setup lang="ts">
definePageMeta({ auth: false })

useSeoMeta({
  title: '3PL Market — construction materials logistics marketplace',
  description: 'Post construction material loads, get bids from vetted 3PL carriers, and track every delivery from pickup to drop-off.',
})
</script>

<template>
  <div>
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
      <UBadge variant="subtle" size="lg" class="mb-4">Built for construction logistics</UBadge>
      <h1 class="text-4xl sm:text-5xl font-bold text-highlighted tracking-tight text-balance">
        Move construction materials.<br>Without the phone tag.
      </h1>
      <p class="mt-4 text-lg text-muted max-w-2xl mx-auto">
        Shippers post loads with an asking price. Carriers accept instantly or counter-bid.
        Dispatch, drivers and delivery confirmation — all in one place.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <UButton to="/register/shipper" size="xl" icon="i-lucide-package">I need materials moved</UButton>
        <UButton to="/register/carrier" size="xl" variant="outline" icon="i-lucide-truck">I haul materials</UButton>
      </div>
    </section>

    <section class="border-t border-default bg-elevated/50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid gap-8 md:grid-cols-3">
        <div>
          <UIcon name="i-lucide-megaphone" class="size-8 text-primary" />
          <h3 class="mt-3 font-semibold text-highlighted">1. Post your load</h3>
          <p class="mt-1 text-sm text-muted">
            Pickup, drop-off, material, weight and your asking price. Your load goes live on the carrier board instantly.
          </p>
        </div>
        <div>
          <UIcon name="i-lucide-gavel" class="size-8 text-primary" />
          <h3 class="mt-3 font-semibold text-highlighted">2. Get bids — or an instant accept</h3>
          <p class="mt-1 text-sm text-muted">
            Carriers take your price on the spot or counter-bid. You pick the winner; everyone else is notified automatically.
          </p>
        </div>
        <div>
          <UIcon name="i-lucide-map-pin-check" class="size-8 text-primary" />
          <h3 class="mt-3 font-semibold text-highlighted">3. Track to delivery</h3>
          <p class="mt-1 text-sm text-muted">
            The carrier assigns a driver and truck. Pickup and delivery are marked in real time, and you confirm completion.
          </p>
        </div>
      </div>
    </section>

    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div class="grid gap-6 md:grid-cols-2">
        <UCard>
          <div class="flex items-start gap-4">
            <UIcon name="i-lucide-building-2" class="size-8 text-primary shrink-0" />
            <div>
              <h3 class="font-semibold text-highlighted">For 3PL carriers</h3>
              <p class="mt-1 text-sm text-muted">
                Manage your fleet and drivers, win loads on the board, and dispatch from one dashboard.
                Driver accounts keep pickup and delivery status honest — GPS tracking is on the roadmap.
              </p>
            </div>
          </div>
        </UCard>
        <UCard>
          <div class="flex items-start gap-4">
            <UIcon name="i-lucide-hard-hat" class="size-8 text-primary shrink-0" />
            <div>
              <h3 class="font-semibold text-highlighted">For builders & suppliers</h3>
              <p class="mt-1 text-sm text-muted">
                Stop calling around for trucks. Post once, compare bids from approved carriers,
                and keep a full event history of every delivery.
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
