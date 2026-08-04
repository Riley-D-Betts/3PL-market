import type { LoadStatus, MaterialType, VehicleType } from '../types'

export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

export function formatWeight(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} t` : `${kg} kg`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  aggregate: 'Aggregate',
  sand: 'Sand',
  gravel: 'Gravel',
  concrete: 'Concrete',
  lumber: 'Lumber',
  steel: 'Steel',
  brick_block: 'Brick / Block',
  drywall: 'Drywall',
  pipe: 'Pipe',
  equipment: 'Equipment',
  other: 'Other',
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  flatbed: 'Flatbed',
  dump_truck: 'Dump truck',
  box_truck: 'Box truck',
  lowboy: 'Lowboy',
  tanker: 'Tanker',
  mixer: 'Mixer',
  other: 'Other',
}

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  awarded: 'Awarded',
  picked_up: 'Picked up',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const LOAD_STATUS_COLORS: Record<LoadStatus, 'neutral' | 'info' | 'primary' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  posted: 'info',
  awarded: 'primary',
  picked_up: 'warning',
  delivered: 'success',
  completed: 'success',
  cancelled: 'error',
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  created: 'Load created',
  posted: 'Posted to the board',
  unposted: 'Taken off the board',
  bid_placed: 'Bid placed',
  bid_withdrawn: 'Bid withdrawn',
  awarded: 'Awarded',
  driver_assigned: 'Driver assigned',
  arrived_pickup: 'Truck arrived at pickup',
  picked_up: 'Picked up — departed pickup',
  arrived_delivery: 'Truck arrived at delivery',
  delivered: 'Delivered — unloaded',
  completed: 'Delivery confirmed',
  cancelled: 'Cancelled',
  note: 'Note',
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
