<script setup lang="ts">
const { user, navItems, home } = useAuthz()
const route = useRoute()
const { clear } = useUserSession()

// The sealed cookie only holds id/role — pull fresh user + company for the
// header block and the pending-approval banner.
const { data: me } = await useFetch('/api/auth/me', {
  key: 'auth-me',
  server: false,
  lazy: true,
})

const companyBanner = computed(() => {
  const company = me.value?.company
  if (!company || user.value?.role !== 'carrier_admin') return null
  if (company.status === 'pending') {
    return { color: 'warning' as const, text: `${company.name} is awaiting platform approval — you can set up your fleet and drivers, but bidding is disabled until approval.` }
  }
  if (company.status === 'suspended') {
    return { color: 'error' as const, text: `${company.name} is suspended${company.suspendedReason ? `: ${company.suspendedReason}` : ''}. Contact the platform operator.` }
  }
  return null
})

const roleLabel = computed(() => {
  switch (user.value?.role) {
    case 'superadmin': return 'Platform admin'
    case 'shipper': return 'Shipper'
    case 'carrier_admin': return 'Carrier admin'
    case 'driver': return 'Driver'
    default: return ''
  }
})

const toast = useToast()

async function logout() {
  // Drivers sign off first: an active shift needs its ending mileage and
  // fuel usage before the day is over. If the check itself fails (expired
  // session, network), fall through — logout must never be blocked.
  if (user.value?.role === 'driver') {
    try {
      const { shift } = await $fetch('/api/driver/shift')
      if (shift) {
        toast.add({ title: 'End your shift first', description: 'Enter your ending mileage and fuel usage to sign off.', color: 'warning' })
        await navigateTo('/driver?end-shift=1')
        return
      }
    }
    catch { /* proceed with logout */ }
  }
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}

function isActive(to: string): boolean {
  if (to === home.value) return route.path === to
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="min-h-screen flex bg-default">
    <aside class="hidden md:flex w-60 shrink-0 flex-col border-r border-default">
      <NuxtLink :to="home" class="flex items-center gap-2 font-bold text-lg text-highlighted h-16 px-5 border-b border-default">
        <UIcon name="i-lucide-truck" class="size-6 text-primary" />
        3PL Market
      </NuxtLink>
      <nav class="flex-1 p-3 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="isActive(item.to)
            ? 'bg-primary/10 text-primary'
            : 'text-muted hover:text-highlighted hover:bg-elevated'"
        >
          <UIcon :name="item.icon" class="size-4.5" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="p-3 border-t border-default">
        <div class="px-2 py-1.5">
          <p class="text-sm font-medium text-highlighted truncate">{{ user?.name }}</p>
          <p class="text-xs text-muted">{{ roleLabel }}</p>
        </div>
        <UButton block variant="ghost" color="neutral" icon="i-lucide-log-out" class="justify-start mt-1" @click="logout">
          Log out
        </UButton>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <!-- Mobile top bar -->
      <header class="md:hidden h-14 border-b border-default flex items-center justify-between px-4">
        <NuxtLink :to="home" class="flex items-center gap-2 font-bold text-highlighted">
          <UIcon name="i-lucide-truck" class="size-5 text-primary" />
          3PL Market
        </NuxtLink>
        <UButton variant="ghost" color="neutral" icon="i-lucide-log-out" @click="logout" />
      </header>
      <nav class="md:hidden flex gap-1 overflow-x-auto border-b border-default px-2 py-1.5">
        <UButton
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          size="sm"
          :variant="isActive(item.to) ? 'soft' : 'ghost'"
          :color="isActive(item.to) ? 'primary' : 'neutral'"
          :icon="item.icon"
        >
          {{ item.label }}
        </UButton>
      </nav>

      <div v-if="companyBanner" class="px-4 sm:px-6 pt-4">
        <UAlert :color="companyBanner.color" variant="subtle" icon="i-lucide-alert-triangle" :description="companyBanner.text" />
      </div>

      <main class="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
