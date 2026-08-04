<script setup lang="ts">
/**
 * Route map for a load: pickup + delivery pins, a dashed route line, and
 * optionally the assigned driver's home base. Leaflet is imported dynamically
 * in onMounted, so the component is SSR-safe without a client-only wrapper
 * (template refs break inside `.client.vue` components).
 */
import type { DivIcon, Map as LeafletMap } from 'leaflet'

export interface MapPoint {
  lat: number | null | undefined
  lng: number | null | undefined
  kind: 'pickup' | 'delivery' | 'home'
  label: string
}

const props = defineProps<{ points: MapPoint[] }>()

const valid = computed(() =>
  props.points.filter((p): p is MapPoint & { lat: number, lng: number } =>
    typeof p.lat === 'number' && typeof p.lng === 'number'))

const container = ref<HTMLElement | null>(null)
let map: LeafletMap | undefined

const PIN_STYLE: Record<MapPoint['kind'], { color: string, icon: string }> = {
  pickup: { color: '#f59e0b', icon: '▲' },
  delivery: { color: '#22c55e', icon: '●' },
  home: { color: '#3b82f6', icon: '⌂' },
}

onMounted(async () => {
  if (!container.value || !valid.value.length) return
  const leaflet = await import('leaflet')
  const L = leaflet.default ?? leaflet
  if (!container.value) return // unmounted while loading

  const pinIcon = (kind: MapPoint['kind']): DivIcon => {
    const { color, icon } = PIN_STYLE[kind]
    return L.divIcon({
      className: '',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);color:white;font-size:12px;line-height:1">${icon}</span></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    })
  }

  map = L.map(container.value, { scrollWheelZoom: false, attributionControl: true })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  for (const point of valid.value) {
    L.marker([point.lat, point.lng], { icon: pinIcon(point.kind) })
      .addTo(map)
      .bindTooltip(point.label, { direction: 'top', offset: [0, -24] })
  }

  const pickup = valid.value.find(p => p.kind === 'pickup')
  const delivery = valid.value.find(p => p.kind === 'delivery')
  if (pickup && delivery) {
    L.polyline([[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]], {
      color: '#f59e0b',
      weight: 2.5,
      dashArray: '6 8',
      opacity: 0.8,
    }).addTo(map)
  }

  const bounds = L.latLngBounds(valid.value.map(p => [p.lat, p.lng] as [number, number]))
  map.fitBounds(bounds.pad(0.25), { maxZoom: 11 })
})

onUnmounted(() => {
  map?.remove()
  map = undefined
})
</script>

<template>
  <div v-if="valid.length" class="relative">
    <div ref="container" class="h-72 w-full rounded-lg overflow-hidden border border-default z-0" />
    <div class="absolute bottom-2 left-2 z-[500] flex gap-2 rounded-md bg-white/90 dark:bg-black/70 px-2 py-1 text-xs shadow">
      <span class="flex items-center gap-1"><span class="inline-block size-2.5 rounded-full" style="background:#f59e0b" /> Pickup</span>
      <span class="flex items-center gap-1"><span class="inline-block size-2.5 rounded-full" style="background:#22c55e" /> Delivery</span>
      <span v-if="valid.some(p => p.kind === 'home')" class="flex items-center gap-1"><span class="inline-block size-2.5 rounded-full" style="background:#3b82f6" /> Driver home base</span>
    </div>
  </div>
</template>
