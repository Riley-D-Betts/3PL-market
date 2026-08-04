interface EstimateFields {
  pickupCity: Ref<string>
  pickupState: Ref<string>
  deliveryCity: Ref<string>
  deliveryState: Ref<string>
  pickupPin: Ref<{ lat: number, lng: number } | null>
  deliveryPin: Ref<{ lat: number, lng: number } | null>
}

/**
 * Debounced drive-time/distance estimate for the posting forms, from the
 * cached OSRM route between the two stops (pins win over city geocoding).
 * Null whenever the stops are incomplete or no route is known.
 */
export function useRouteEstimate(fields: EstimateFields) {
  const estimate = ref<{ durationMin: number, miles: number } | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let requestSeq = 0

  const ready = computed(() =>
    fields.pickupCity.value.trim().length > 0
    && fields.pickupState.value.trim().length > 0
    && fields.deliveryCity.value.trim().length > 0
    && fields.deliveryState.value.trim().length > 0)

  watch(
    [fields.pickupCity, fields.pickupState, fields.deliveryCity, fields.deliveryState, fields.pickupPin, fields.deliveryPin],
    () => {
      clearTimeout(timer)
      if (!ready.value) {
        // Invalidate any in-flight request too — its response must not
        // resurrect an estimate for stops that are no longer complete.
        requestSeq++
        estimate.value = null
        return
      }
      timer = setTimeout(async () => {
        const seq = ++requestSeq
        try {
          const { estimate: result } = await $fetch('/api/route-estimate', {
            query: {
              pickupCity: fields.pickupCity.value,
              pickupState: fields.pickupState.value,
              deliveryCity: fields.deliveryCity.value,
              deliveryState: fields.deliveryState.value,
              pickupLat: fields.pickupPin.value?.lat,
              pickupLng: fields.pickupPin.value?.lng,
              deliveryLat: fields.deliveryPin.value?.lat,
              deliveryLng: fields.deliveryPin.value?.lng,
            },
          })
          if (seq === requestSeq) estimate.value = result
        }
        catch {
          if (seq === requestSeq) estimate.value = null
        }
      }, 800)
    },
  )

  onUnmounted(() => clearTimeout(timer))
  return estimate
}
