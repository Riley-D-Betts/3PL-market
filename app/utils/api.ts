export function apiErrorMessage(err: unknown): string {
  const e = err as { data?: { statusMessage?: string, message?: string }, message?: string }
  return e?.data?.statusMessage || e?.data?.message || e?.message || 'Something went wrong'
}
