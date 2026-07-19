import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import * as L from 'leaflet'


/**
 * MapTilerLayer
 * Drop-in replacement for react-leaflet's <TileLayer>.
 * Renders MapTiler vector tiles when the SDK plugin is installed and
 * a valid key is set; otherwise falls back to OSM raster tiles so the
 * map (and the rest of the app) never white-screens.
 *
 * Usage (replace this):
 *   <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="..." />
 *
 * With this:
 *   <MapTilerLayer styleName="streets-v2-dark" />
 *
 * REQUIRED setup for vector tiles to actually load:
 *   1. npm install @maptiler/leaflet-maptilersdk
 *   2. Add VITE_MAPTILER_KEY=your_key to .env
 *   3. Restart the dev server (Vite only reads .env at startup)
 *
 * If step 1 was skipped, this component automatically uses OSM
 * raster tiles instead — it never throws.
 */

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || ''

function addOsmFallback(map, reason) {
  if (reason) console.warn(`[MapTilerLayer] ${reason} — falling back to OSM raster tiles.`)
  const fallback = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  })
  fallback.addTo(map)
  return fallback
}

export default function MapTilerLayer({ styleName = 'streets-v2-dark' }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    let layer = null

    if (!MAPTILER_KEY) {
      layer = addOsmFallback(map, 'VITE_MAPTILER_KEY is not set')
    } else if (typeof L.maptilerLayer !== 'function') {
      // The plugin import either failed or was never installed —
      // never call a function that doesn't exist.
      layer = addOsmFallback(
        map,
        '@maptiler/leaflet-maptilersdk is not installed (run: npm install @maptiler/leaflet-maptilersdk)'
      )
    } else {
      try {
        layer = L.maptilerLayer({ apiKey: MAPTILER_KEY, style: styleName })
        layer.addTo(map)
      } catch (err) {
        console.error('[MapTilerLayer] Failed to initialise vector layer:', err)
        layer = addOsmFallback(map, 'vector layer init threw an error')
      }
    }

    layerRef.current = layer

    return () => {
      if (layer) {
        try { map.removeLayer(layer) } catch { /* already removed */ }
      }
    }
  }, [map, styleName])

  return null
}