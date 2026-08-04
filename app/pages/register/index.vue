<script setup lang="ts">
definePageMeta({ auth: false })
useSeoMeta({ title: 'Register — 3PL Market' })
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-16">
    <h1 class="text-2xl font-bold text-highlighted text-center">Create your account</h1>
    <p class="text-muted text-center mt-2">What brings you to 3PL Market?</p>
    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <NuxtLink to="/register/shipper" class="group">
        <UCard class="h-full transition-shadow group-hover:shadow-md">
          <UIcon name="i-lucide-package" class="size-8 text-primary" />
          <h2 class="mt-3 font-semibold text-highlighted">I need materials moved</h2>
          <p class="mt-1 text-sm text-muted">Post loads, review carrier bids and track deliveries.</p>
        </UCard>
      </NuxtLink>
      <NuxtLink to="/register/carrier" class="group">
        <UCard class="h-full transition-shadow group-hover:shadow-md">
          <UIcon name="i-lucide-truck" class="size-8 text-primary" />
          <h2 class="mt-3 font-semibold text-highlighted">I run a trucking company</h2>
          <p class="mt-1 text-sm text-muted">Register your 3PL company, bid on loads and dispatch drivers.</p>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
