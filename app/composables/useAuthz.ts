import type { Role } from '#shared/types'

export function roleHome(role: Role | undefined | null): string {
  switch (role) {
    case 'superadmin': return '/admin'
    case 'shipper': return '/shipper'
    case 'carrier_admin': return '/carrier'
    case 'driver': return '/driver'
    default: return '/'
  }
}

export interface NavItem {
  label: string
  to: string
  icon: string
}

export function useAuthz() {
  const { user, loggedIn } = useUserSession()

  const role = computed<Role | null>(() => user.value?.role ?? null)
  const home = computed(() => roleHome(role.value))

  const navItems = computed<NavItem[]>(() => {
    switch (role.value) {
      case 'shipper':
        return [
          { label: 'My loads', to: '/shipper', icon: 'i-lucide-package' },
          { label: 'Post a load', to: '/shipper/loads/new', icon: 'i-lucide-plus-circle' },
          { label: 'Settings', to: '/shipper/settings', icon: 'i-lucide-settings' },
        ]
      case 'carrier_admin':
        return [
          { label: 'Dashboard', to: '/carrier', icon: 'i-lucide-layout-dashboard' },
          { label: 'Load board', to: '/carrier/board', icon: 'i-lucide-search' },
          { label: 'Won loads', to: '/carrier/loads', icon: 'i-lucide-truck' },
          { label: 'Bids', to: '/carrier/bids', icon: 'i-lucide-gavel' },
          { label: 'Fleet', to: '/carrier/fleet', icon: 'i-lucide-bus-front' },
          { label: 'Drivers', to: '/carrier/drivers', icon: 'i-lucide-users' },
        ]
      case 'driver':
        return [
          { label: 'My loads', to: '/driver', icon: 'i-lucide-truck' },
        ]
      case 'superadmin':
        return [
          { label: 'Overview', to: '/admin', icon: 'i-lucide-layout-dashboard' },
          { label: 'Companies', to: '/admin/companies', icon: 'i-lucide-building-2' },
          { label: 'Users', to: '/admin/users', icon: 'i-lucide-users' },
          { label: 'Loads', to: '/admin/loads', icon: 'i-lucide-package' },
        ]
      default:
        return []
    }
  })

  return { user, loggedIn, role, home, navItems }
}
