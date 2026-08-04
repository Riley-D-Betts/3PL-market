<script setup lang="ts">
const { loggedIn, home } = useAuthz()
</script>

<template>
  <div class="min-h-screen flex flex-col bg-default">
    <header class="border-b border-default">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 font-bold text-lg text-highlighted">
          <UIcon name="i-lucide-truck" class="size-6 text-primary" />
          3PL Market
        </NuxtLink>
        <nav class="flex items-center gap-2">
          <template v-if="loggedIn">
            <UButton :to="home" variant="soft" icon="i-lucide-layout-dashboard">Dashboard</UButton>
          </template>
          <template v-else>
            <UButton to="/login" variant="ghost" color="neutral">Log in</UButton>
            <UButton to="/register" icon="i-lucide-arrow-right" trailing>Get started</UButton>
          </template>
        </nav>
      </div>
    </header>
    <main class="flex-1">
      <slot />
    </main>
    <footer class="border-t border-default py-6 text-center text-sm text-muted">
      3PL Market — construction materials logistics marketplace
    </footer>
  </div>
</template>
