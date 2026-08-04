import { describe, expect, it } from 'vitest'
import { haversineMiles, parseLatLng } from '../../shared/utils/geo'
import { formatMiles, formatWeight } from '../../shared/utils/format'

describe('haversineMiles', () => {
  it('measures Boise → Nampa at roughly 18 miles', () => {
    const d = haversineMiles(43.6150, -116.2023, 43.5407, -116.5635)
    expect(d).toBeGreaterThan(15)
    expect(d).toBeLessThan(21)
  })

  it('is zero for identical points', () => {
    expect(haversineMiles(43.6, -116.2, 43.6, -116.2)).toBe(0)
  })
})

describe('parseLatLng', () => {
  it('parses raw "lat, lng" text', () => {
    expect(parseLatLng('43.6150, -116.2023')).toEqual({ lat: 43.6150, lng: -116.2023 })
    expect(parseLatLng('  43.6150,-116.2023  ')).toEqual({ lat: 43.6150, lng: -116.2023 })
  })

  it('parses Google Maps place URLs via the !3d!4d pin position', () => {
    const url = 'https://www.google.com/maps/place/Boise+Airport/@43.5658,-116.2274,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d43.5644!4d-116.2228!16s'
    expect(parseLatLng(url)).toEqual({ lat: 43.5644, lng: -116.2228 })
  })

  it('parses map-center @lat,lng URLs', () => {
    expect(parseLatLng('https://www.google.com/maps/@43.6150,-116.2023,12z')).toEqual({ lat: 43.6150, lng: -116.2023 })
  })

  it('parses q= and ll= query params, including loc: prefixes', () => {
    expect(parseLatLng('https://maps.google.com/?q=43.615,-116.202')).toEqual({ lat: 43.615, lng: -116.202 })
    expect(parseLatLng('https://maps.google.com/maps?ll=43.615,-116.202&z=14')).toEqual({ lat: 43.615, lng: -116.202 })
    expect(parseLatLng('https://maps.google.com/?q=loc:43.615,-116.202')).toEqual({ lat: 43.615, lng: -116.202 })
  })

  it('parses geo: URIs', () => {
    expect(parseLatLng('geo:43.615,-116.202')).toEqual({ lat: 43.615, lng: -116.202 })
  })

  it('rejects street addresses, out-of-range values and null island', () => {
    expect(parseLatLng('900 Supply Yard Rd')).toBeNull()
    expect(parseLatLng('Boise, ID')).toBeNull()
    expect(parseLatLng('95.0, -116.2')).toBeNull()
    expect(parseLatLng('43.6, -190.4')).toBeNull()
    expect(parseLatLng('0, 0')).toBeNull()
    expect(parseLatLng('')).toBeNull()
  })
})

describe('imperial formatters', () => {
  it('formats pounds under a ton as lbs', () => {
    expect(formatWeight(900)).toBe('900 lbs')
    expect(formatWeight(1999)).toBe('1,999 lbs')
  })

  it('formats a ton and up as short tons', () => {
    expect(formatWeight(2000)).toBe('1 tons')
    expect(formatWeight(33000)).toBe('16.5 tons')
    expect(formatWeight(40000)).toBe('20 tons')
  })

  it('formats miles with one decimal under 10', () => {
    expect(formatMiles(3.44)).toBe('3.4 mi')
    expect(formatMiles(51.2)).toBe('51 mi')
    expect(formatMiles(null)).toBe('—')
  })
})
