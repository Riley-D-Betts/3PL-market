import type { Role } from '#shared/types'

interface AuthMeta {
  roles?: Role[]
}

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()
  const auth = to.meta.auth as AuthMeta | false | undefined

  // Public page — send logged-in users from login/register to their home.
  if (auth === false) {
    if (loggedIn.value && (to.path === '/login' || to.path.startsWith('/register'))) {
      return navigateTo(roleHome(user.value?.role))
    }
    return
  }

  if (!loggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  const roles = auth?.roles
  if (roles && user.value && !roles.includes(user.value.role)) {
    return navigateTo(roleHome(user.value.role))
  }
})
