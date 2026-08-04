import { describe, expect, it } from 'vitest'
import { detentionFeeCents, detentionMinutes } from '../../server/utils/detention'

const T0 = new Date('2026-08-05T08:00:00Z')
const after = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)

describe('detentionMinutes', () => {
  it('is zero while inside the free window', () => {
    expect(detentionMinutes(T0, after(45), 120)).toBe(0)
  })

  it('is zero exactly at the free window boundary', () => {
    expect(detentionMinutes(T0, after(120), 120)).toBe(0)
  })

  it('counts whole minutes beyond the free window', () => {
    expect(detentionMinutes(T0, after(121), 120)).toBe(1)
    expect(detentionMinutes(T0, after(190), 120)).toBe(70)
  })

  it('floors sub-minute waits to whole minutes', () => {
    const departed = new Date(T0.getTime() + 121 * 60_000 + 59_000)
    expect(detentionMinutes(T0, departed, 120)).toBe(1)
  })

  it('treats null free minutes as zero free time', () => {
    expect(detentionMinutes(T0, after(30), null)).toBe(30)
  })

  it('is null when the arrival was never logged', () => {
    expect(detentionMinutes(null, after(500), 120)).toBeNull()
  })

  it('never goes negative', () => {
    expect(detentionMinutes(T0, T0, 120)).toBe(0)
  })
})

describe('detentionFeeCents', () => {
  it('prorates per minute, rounding up to whole cents', () => {
    expect(detentionFeeCents(1, 7500)).toBe(125) // 7500/60 = 125
    expect(detentionFeeCents(70, 7500)).toBe(8750)
    expect(detentionFeeCents(1, 100)).toBe(2) // 100/60 = 1.67 → 2
  })

  it('is zero for zero minutes or zero rate', () => {
    expect(detentionFeeCents(0, 7500)).toBe(0)
    expect(detentionFeeCents(90, 0)).toBe(0)
  })

  it('is null when inputs are unknown', () => {
    expect(detentionFeeCents(null, 7500)).toBeNull()
    expect(detentionFeeCents(10, null)).toBeNull()
  })
})
