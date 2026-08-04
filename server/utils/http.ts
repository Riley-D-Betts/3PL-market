import type { H3Event } from 'h3'
import { createError, getRouterParam } from 'h3'
import { z } from 'zod'

export function getUuidParam(event: H3Event, name = 'id'): string {
  const parsed = z.uuid().safeParse(getRouterParam(event, name))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id parameter' })
  }
  return parsed.data
}
