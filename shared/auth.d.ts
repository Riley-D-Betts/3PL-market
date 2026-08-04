import type { Role } from './types'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: Role
    companyId: string | null
  }
}

export {}
