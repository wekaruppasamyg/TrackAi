import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || ''

/**
 * MapLibreContainer - Modern MapLibre GL map with MapTiler integration
 * Replaces React Leaflet for better performance and 3D capabilities
 * 
 * Usage:
 * <MapLibreContainer
 *   center={[lng, lat]}      // [longitude, latitude]
 *   zoom={15}
 *   style="streets-v2-dark"
 *   onMapLoad={mapInstance => {...}}
 *   className="my-map-class"
 * >
 *   {children}
 * </MapLibreContainer>
 */
export default function MapLibreContainer({
  center = [0, 51.5],  // [lng, lat] format for MapLibre
  zoom = 13,
  style = 'streets-v2-dark',
  onMapLoad = null,
  className = '',
  children = null,
  ...mapOptions
}) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [mapError, setMapError] = useState(() => !navigator.onLine)

  useEffect(() => {
    if (!mapContainer.current) return

    // Guard against double-init
    if (map.current) return

    // Validate API key
    if (!MAPTILER_KEY) {
      console.error('[MapLibreContainer] VITE_MAPTILER_KEY is not set in .env')
      return
    }

    // Initialize map
    try {
      const offlineStyle = {
        version: 8,
        sources: {},
        layers: [{ id: 'offline-background', type: 'background', paint: { 'background-color': '#17243a' } }],
      }
      const newMap = new maplibregl.Map({
        container: mapContainer.current,
        style: navigator.onLine
          ? `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`
          : offlineStyle,
        center: center,
        zoom: zoom,
        pitch: 0,
        bearing: 0,
        ...mapOptions,
      })
      map.current = newMap

      // Add navigation controls
      const nav = new maplibregl.NavigationControl({ visualizePitch: true })
      newMap.addControl(nav, 'top-right')

      // Add attribution
      newMap.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right')

      newMap.on('load', () => {
        map.current = newMap
        setIsReady(true)
        onMapLoad?.(newMap)
      })

      newMap.on('error', (e) => {
        setMapError(true)
      })
    } catch (err) {
      console.error('[MapLibreContainer] Failed to initialize map:', err)
    }

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update center if prop changes
  useEffect(() => {
    if (map.current && isReady && center) {
      map.current.flyTo({ center, zoom, duration: 1000 })
    }
  }, [center, zoom])

  return (
    <div
      ref={mapContainer}
      className={`maplibre-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        minHeight: '500px',
      }}
    >
      {mapError && (
        <div style={{position:'absolute',inset:0,zIndex:2,display:'grid',placeItems:'center',background:'rgba(10,18,32,.72)',color:'#cbd5e1',fontSize:13,textAlign:'center',padding:24,pointerEvents:'none'}}>
          Map tiles unavailable. Check your internet connection; route data still works.
        </div>
      )}
      {isReady && children && React.Children.toArray(children)
        .filter(child => child != null)
        .map((child, idx) => 
          React.cloneElement(child, { key: idx, map: map.current })
        )
      }
    </div>
  )
}

// Export map instance for advanced usage
export { maplibregl }
