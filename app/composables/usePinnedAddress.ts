import { parseLatLng } from '#shared/utils/geo'

/**
 * Watches an address field for dropped/pasted Google Maps pins (share URLs,
 * geo: URIs or raw "lat, lng"). When one lands, captures the coordinates and
 * compacts the field text to "lat, lng" so the URL noise disappears.
 * Editing the field to anything that no longer parses clears the pin.
 */
const RAW_COORDS = /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/

export function usePinnedAddress(address: Ref<string>) {
  const pin = ref<{ lat: number, lng: number } | null>(null)

  watch(address, (value) => {
    const parsed = parseLatLng(value ?? '')
    if (!parsed) {
      pin.value = null
      return
    }
    pin.value = parsed
    // Compact only URL/geo-URI noise. Plain "lat, lng" text is left exactly
    // as typed — rewriting it would fight the user's cursor on every keystroke.
    if (!RAW_COORDS.test((value ?? '').trim())) {
      address.value = `${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`
    }
  })

  return pin
}
