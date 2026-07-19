import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

/**
 * Marker component for MapLibre GL
 * Replaces react-leaflet Marker
 */
export function Marker({ map, position, icon, onClick, popupContent }) {
  const markerRef = useRef(null)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!map || !position) return

    const el = document.createElement('div')
    el.className = 'maplibre-marker'
    
    if (icon && icon.element) {
      el.appendChild(icon.element.cloneNode(true))
    } else if (icon) {
      el.innerHTML = icon
    } else {
      el.style.cssText = `
        width: 32px;
        height: 32px;
        background-color: #3fb1ce;
        border: 3px solid #fff;
        border-radius: 50%;
        cursor: pointer;
      `
    }

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([position[1], position[0]])  // [lat, lng] → [lng, lat]

    if (popupContent) {
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent)
      marker.setPopup(popup)
    }

    marker.addTo(map)

    if (onClick) {
      el.addEventListener('click', () => onClick())
    }

    markerRef.current = marker
    popupRef.current = marker.getPopup()

    return () => {
      marker.remove()
    }
  }, [map, position, icon, popupContent, onClick])

  return null
}

/**
 * Polyline component for MapLibre GL
 * Replaces react-leaflet Polyline
 */
export function Polyline({ map, positions, options = {} }) {
  const layerId = useRef(`polyline-${Math.random().toString(36).substr(2, 9)}`)
  const sourceId = useRef(`polyline-source-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    if (!map || !positions || positions.length < 2) return

    // Convert [lat, lng] to [lng, lat] for GeoJSON
    const coords = positions.map(pos => [pos[1], pos[0]])

    // Add source
    try {
      map.addSource(sourceId.current, {
        type: 'geojson',
        data: {
          type: 'LineString',
          coordinates: coords,
        },
      })

      // Add layer
      map.addLayer({
        id: layerId.current,
        type: 'line',
        source: sourceId.current,
        paint: {
          'line-color': options.color || '#3fb1ce',
          'line-width': options.weight || 2,
          'line-opacity': options.opacity !== undefined ? options.opacity : 0.8,
        },
      })
    } catch (err) {
      console.error('[Polyline] Failed to add polyline:', err)
    }

    return () => {
      try {
        if (map.getLayer(layerId.current)) map.removeLayer(layerId.current)
        if (map.getSource(sourceId.current)) map.removeSource(sourceId.current)
      } catch (err) {
        console.error('[Polyline] Failed to remove polyline:', err)
      }
    }
  }, [map, positions, options])

  return null
}

/**
 * Circle component for MapLibre GL
 * Replaces react-leaflet Circle
 */
export function Circle({ map, center, radius, options = {} }) {
  const layerId = useRef(`circle-${Math.random().toString(36).substr(2, 9)}`)
  const sourceId = useRef(`circle-source-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    if (!map || !center || !radius) return

    // Create circle as polygon (GeoJSON)
    const earth = 6371000 // meters
    const lat = center[0]
    const lng = center[1]
    const latDelta = (radius / earth) * (180 / Math.PI)
    const lngDelta = (radius / earth) * (180 / Math.PI) / Math.cos((lat * Math.PI) / 180)

    const coordinates = []
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * (2 * Math.PI)
      coordinates.push([
        lng + lngDelta * Math.cos(angle),
        lat + latDelta * Math.sin(angle),
      ])
    }

    try {
      map.addSource(sourceId.current, {
        type: 'geojson',
        data: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      })

      map.addLayer({
        id: layerId.current,
        type: 'fill',
        source: sourceId.current,
        paint: {
          'fill-color': options.fillColor || '#3fb1ce',
          'fill-opacity': options.fillOpacity || 0.2,
          'fill-outline-color': options.color || '#3fb1ce',
        },
      })
    } catch (err) {
      console.error('[Circle] Failed to add circle:', err)
    }

    return () => {
      try {
        if (map.getLayer(layerId.current)) map.removeLayer(layerId.current)
        if (map.getSource(sourceId.current)) map.removeSource(sourceId.current)
      } catch (err) {
        console.error('[Circle] Failed to remove circle:', err)
      }
    }
  }, [map, center, radius, options])

  return null
}

/**
 * CircleMarker component for MapLibre GL
 * Replaces react-leaflet CircleMarker
 */
export function CircleMarker({ map, center, radius = 10, options = {} }) {
  const layerId = useRef(`circle-marker-${Math.random().toString(36).substr(2, 9)}`)
  const sourceId = useRef(`circle-marker-source-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    if (!map || !center) return

    try {
      map.addSource(sourceId.current, {
        type: 'geojson',
        data: {
          type: 'Point',
          coordinates: [center[1], center[0]],  // [lng, lat]
        },
      })

      map.addLayer({
        id: layerId.current,
        type: 'circle',
        source: sourceId.current,
        paint: {
          'circle-radius': radius,
          'circle-color': options.fillColor || '#3fb1ce',
          'circle-opacity': options.fillOpacity || 0.8,
          'circle-stroke-width': options.weight || 2,
          'circle-stroke-color': options.color || '#fff',
          'circle-stroke-opacity': options.opacity || 1,
        },
      })
    } catch (err) {
      console.error('[CircleMarker] Failed to add circle marker:', err)
    }

    return () => {
      try {
        if (map.getLayer(layerId.current)) map.removeLayer(layerId.current)
        if (map.getSource(sourceId.current)) map.removeSource(sourceId.current)
      } catch (err) {
        console.error('[CircleMarker] Failed to remove circle marker:', err)
      }
    }
  }, [map, center, radius, options])

  return null
}

/**
 * Popup component for MapLibre GL
 * Returns HTML string for use with popupContent
 */
export function createPopup(content) {
  if (typeof content === 'string') return content
  if (React.isValidElement(content)) {
    const div = document.createElement('div')
    ReactDOM.createRoot(div).render(content)
    return div.innerHTML
  }
  return JSON.stringify(content)
}
