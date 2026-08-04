import { describe, expect, it } from 'vitest'
import { shapeRoute } from '../../server/utils/routing'

describe('shapeRoute', () => {
  it('passes null through', () => {
    expect(shapeRoute(null)).toBeNull()
  })

  it('rounds duration to whole minutes', () => {
    const g: [number, number][] = [[-116.2, 43.6], [-116.5, 43.5]]
    expect(shapeRoute({ durationSec: 90, distanceMeters: 19312, geometry: g }))
      .toEqual({ durationMin: 2, miles: 12, geometry: g })
    expect(shapeRoute({ durationSec: 2031, distanceMeters: 36277, geometry: g })!.durationMin).toBe(34)
  })

  it('rounds road miles to one decimal', () => {
    expect(shapeRoute({ durationSec: 60, distanceMeters: 2012, geometry: [] })!.miles).toBe(1.3)
    expect(shapeRoute({ durationSec: 60, distanceMeters: 1609, geometry: [] })!.miles).toBe(1)
  })
})
