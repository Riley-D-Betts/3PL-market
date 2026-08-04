<script setup lang="ts">
definePageMeta({ layout: 'dashboard', auth: { roles: ['superadmin'] } })
useSeoMeta({ title: 'Users — 3PL Market' })

const toast = useToast()
const { user: sessionUser } = useUserSession()
const { data, refresh } = await useFetch('/api/admin/users')

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Platform admin',
  shipper: 'Shipper',
  carrier_admin: 'Carrier admin',
  driver: 'Driver',
}

async function setActive(id: string, active: boolean) {
  try {
    await $fetch(`/api/admin/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' })
    await refresh()
    toast.add({ title: active ? 'User reactivated' : 'User deactivated', color: 'success' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-highlighted mb-6">Users</h1>
    <div class="space-y-3">
      <UCard v-for="user in data?.users" :key="user.id">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="flex-1 min-w-48">
            <p class="font-medium text-highlighted">{{ user.name }}</p>
            <p class="text-sm text-muted mt-0.5">
              {{ user.email }} · {{ ROLE_LABELS[user.role] }}<span v-if="user.companyName"> · {{ user.companyName }}</span>
            </p>
          </div>
          <UBadge :color="user.isActive ? 'success' : 'neutral'" variant="subtle">
            {{ user.isActive ? 'active' : 'deactivated' }}
          </UBadge>
          <UButton
            v-if="user.id !== sessionUser?.id"
            size="sm"
            variant="soft"
            :color="user.isActive ? 'error' : 'success'"
            @click="setActive(user.id, !user.isActive)"
          >
            {{ user.isActive ? 'Deactivate' : 'Reactivate' }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
