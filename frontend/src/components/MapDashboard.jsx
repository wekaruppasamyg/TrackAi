import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useLocationStore, useGeofenceStore } from '../store'
import { locationAPI, geofenceAPI } from '../services/api'
import MapLibreContainer, { maplibregl } from './MapLibreContainer'
import { Marker, Polyline, Circle, CircleMarker } from './MapLibreMarkers'
import WeatherWidget from './Weatherwidget'
import '../styles/map.css'

// Live-location dot — Google-Maps/"share live location" style:
// solid green dot + white ring + two expanding translucent pulse rings.
function makeLiveDotIconHTML() {
  return `
    <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;
        background:rgba(74,222,128,0.35);
        animation:live-dot-ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute;inset:6px;border-radius:50%;
        background:rgba(74,222,128,0.25);
        animation:live-dot-ping 1.8s cubic-bezier(0,0,0.2,1) 0.5s infinite;"></div>
      <div style="position:relative;width:16px;height:16px;border-radius:50%;
        background:#4ade80;border:3px solid #fff;
        box-shadow:0 0 0 2px rgba(74,222,128,0.5), 0 2px 10px rgba(0,0,0,0.45);"></div>
    </div>
    <style>
      @keyframes live-dot-ping {
        0%   { transform:scale(0.5); opacity:0.9; }
        100% { transform:scale(2.4); opacity:0; }
      }
    </style>
  `
}

// Small history-stop dot — themed orange, no blue fallback circle.
function makeStopIconHTML() {
  return `
    <div style="width:12px;height:12px;border-radius:50%;
      background:#fc8019;border:2px solid rgba(11, 141, 19, 0.85);
      box-shadow:0 0 0 1px rgba(12, 218, 94, 0.4), 0 1px 4px rgba(0,0,0,0.5);
      cursor:pointer;"></div>
  `
}

const STALE_MS = 300_000

export default function MapDashboard({ userId }) {
  const locations       = useLocationStore((s) => s.locations)
  const currentLocation = useLocationStore((s) => s.currentLocation)
  const isTracking      = useLocationStore((s) => s.isTracking)
  const geofences       = useGeofenceStore((s) => s.geofences)

  const reduceMotion = useReducedMotion()
  const [, setTick]  = useState(0)
  const mapRef = useRef(null)
  const [mapCenter,     setMapCenter]     = useState([-0.09, 51.505])  // [lng, lat] format
  const [mapZoom,       setMapZoom]       = useState(15)
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [showGeofences, setShowGeofences] = useState(true)

  const loadLocations = useCallback(async () => {
    const existing = useLocationStore.getState().locations
    if (existing.length > 0) {
      setMapCenter([existing[0].longitude, existing[0].latitude])  // [lng, lat]
      setLoading(false)
      return
    }
    try {
      const res = await locationAPI.getLocations()
      useLocationStore.setState({ locations: res.data, currentLocation: res.data[0] || null })
      if (res.data.length > 0) setMapCenter([res.data[0].longitude, res.data[0].latitude])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const loadGeofences = useCallback(async () => {
    try {
      const res = await geofenceAPI.getGeofences()
      useGeofenceStore.setState({ geofences: res.data })
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { loadLocations(); loadGeofences() }, [userId])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (locations.length > 0) setMapCenter([locations[0].longitude, locations[0].latitude])  // [lng, lat]
  }, [locations])

  const now       = Date.now()
  const currentTs = currentLocation?.timestamp ? new Date(currentLocation.timestamp).getTime() : null
  const isLive    = currentTs != null ? (isTracking || now - currentTs <= STALE_MS) : false
  const isStale   = currentTs != null ? now - currentTs > STALE_MS : false

  const filteredLocations = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return locations
    return locations.filter((loc) => {
      const lat = Number(loc.latitude).toFixed(4)
      const lon = Number(loc.longitude).toFixed(4)
      const ts  = loc.timestamp ? new Date(loc.timestamp).toLocaleString() : ''
      return `${lat} ${lon} ${ts}`.toLowerCase().includes(q)
    })
  }, [locations, search])

  const livePanPos = useMemo(() => {
    if (!isTracking || !currentLocation) return null
    return [currentLocation.longitude, currentLocation.latitude]  // [lng, lat]
  }, [isTracking, currentLocation])

  if (loading) {
    return (
      <div className="map-loading">
        <motion.div className="map-loading-inner"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}>
          <div className="map-loading-spinner" />
          <div>Loading map…</div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="map-dashboard">
      {/* Full-screen map FIRST so it's behind the panel */}
      <div className="map-main">
        <MapLibreContainer
          center={mapCenter}
          zoom={mapZoom}
          style="streets-v2-dark"
          onMapLoad={(map) => {
            mapRef.current = map
            // Pan to live position when tracking starts
            if (livePanPos) {
              map.flyTo({ center: livePanPos, zoom: 17, duration: 1000 })
            }
          }}
          className="map-container"
        >
          {/* Current live position marker */}
          {isLive && currentLocation && (
            <Marker
              map={mapRef.current}
              position={[currentLocation.latitude, currentLocation.longitude]}
              icon={makeLiveDotIconHTML()}
              popupContent={`
                <div class="location-popup">
                  <p>📍 You are here</p>
                  <p>Lat: ${Number(currentLocation.latitude).toFixed(5)}</p>
                  <p>Lon: ${Number(currentLocation.longitude).toFixed(5)}</p>
                  <p>${new Date(currentLocation.timestamp).toLocaleTimeString()}</p>
                </div>
              `}
            />
          )}

          {/* History markers — small themed dot, not the default blue circle */}
          {filteredLocations.map((loc, idx) => {
            if (idx === 0 && isLive) return null
            return (
              <Marker
                key={loc.id || idx}
                map={mapRef.current}
                position={[loc.latitude, loc.longitude]}
                icon={makeStopIconHTML()}
                popupContent={`
                  <div class="location-popup">
                    <p>📍 Stop #${idx + 1}</p>
                    <p>Lat: ${Number(loc.latitude).toFixed(5)}</p>
                    <p>Lon: ${Number(loc.longitude).toFixed(5)}</p>
                    <p>${new Date(loc.timestamp).toLocaleString()}</p>
                    ${loc.speed != null ? `<p>Speed: ${Number(loc.speed).toFixed(1)} m/s</p>` : ''}
                  </div>
                `}
              />
            )
          })}

          {/* Geofence circles */}
          {showGeofences && geofences.map((gf) => (
            <Circle
              key={gf.id}
              map={mapRef.current}
              center={[gf.latitude, gf.longitude]}
              radius={gf.radius}
              options={{
                color: '#fc8019',
                fillColor: '#fc8019',
                fillOpacity: 0.08,
                weight: 2,
              }}
            />
          ))}
        </MapLibreContainer>

        {/* Weather widget — bottom-right, uses current GPS coords if available */}
        <WeatherWidget
          lat={currentLocation?.latitude ?? null}
          lon={currentLocation?.longitude ?? null}
          position="bottom-right"
        />
      </div>

      {/* Floating sidebar panel OVER the map */}
      <AnimatePresence>
        <motion.div className="map-hud" key="hud"
          initial={reduceMotion ? undefined : { opacity: 0, x: -10 }}
          animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}>

          <div className="map-right-panel">
            <div className="map-panel map-ai-panel">

              {/* Header */}
              <div className="map-sidebar-header">
                <div className="map-sidebar-title">
                  <span className="map-sidebar-title-mark" />
                  Live Tracker
                </div>
                <div className="map-sidebar-sub">
                  {isTracking
                    ? <span className="map-tracking-badge"><span className="map-tracking-dot" />Broadcasting live</span>
                    : 'Start tracking to go live'}
                </div>
              </div>

              {/* Search */}
              <div className="map-panel-section">
                <div className="map-panel-label">Search</div>
                <input className="map-search" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by lat / lon / time…" />
              </div>

              {/* Geofence toggle */}
              <div className="map-panel-section">
                <label className="map-toggle">
                  <input type="checkbox" checked={showGeofences}
                    onChange={(e) => setShowGeofences(e.target.checked)} />
                  <span>Show geofences</span>
                </label>
              </div>

              {/* Stats */}
              <div className="map-stats">
                <div className="map-stat">
                  <div className="map-stat-value">{filteredLocations.length}</div>
                  <div className="map-stat-label">Stops</div>
                </div>
                <div className="map-stat">
                  <div className="map-stat-value">{geofences.length}</div>
                  <div className="map-stat-label">Zones</div>
                </div>
              </div>

              {/* Live GPS info */}
              <div className="map-live-card">
                <div className="map-panel-label">Active GPS</div>
                <div className="map-live-grid">
                  <div className="map-live-top">
                    <div className="map-live-title">
                      <span className={
                        isLive  ? 'map-live-dot map-live-dot--live'
                      : isStale ? 'map-live-dot map-live-dot--stale'
                      :           'map-live-dot map-live-dot--off'
                      } />
                      {currentLocation ? (isLive ? 'LIVE' : 'LAST KNOWN') : 'NO SIGNAL'}
                    </div>
                    {currentLocation?.timestamp && (
                      <div className="map-live-sub">
                        {new Date(currentLocation.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  <div className="map-live-fields">
                    {currentLocation ? (
                      <>
                        <div className="map-kv">
                          <span className="map-kv-label">Latitude</span>
                          <span className="map-kv-value">{Number(currentLocation.latitude).toFixed(5)}</span>
                        </div>
                        <div className="map-kv">
                          <span className="map-kv-label">Longitude</span>
                          <span className="map-kv-value">{Number(currentLocation.longitude).toFixed(5)}</span>
                        </div>
                        <div className="map-kv-row">
                          {currentLocation.accuracy != null && (
                            <div className="map-badge">
                              <span className="map-badge-label">Accuracy</span>
                              <span className="map-badge-value">{Number(currentLocation.accuracy).toFixed(0)}m</span>
                            </div>
                          )}
                          {currentLocation.speed != null && (
                            <div className="map-badge">
                              <span className="map-badge-label">Speed</span>
                              <span className="map-badge-value">{Number(currentLocation.speed).toFixed(1)} m/s</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="map-live-empty">Go to <strong>Tracking</strong> to start.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status pills */}
            <div className="map-status-badges">
              <div className={`map-status ${isLive ? 'map-status--live' : isStale ? 'map-status--stale' : ''}`}>
                <div className="map-status-glow" />
                <div className="map-status-title">Signal</div>
                <div className="map-status-value">
                  {currentLocation ? (isLive ? '● LIVE' : 'UPDATING') : 'OFFLINE'}
                </div>
              </div>
              <div className="map-status">
                <div className="map-status-title">Accuracy</div>
                <div className="map-status-value">
                  {currentLocation?.accuracy != null
                    ? `${Math.max(0, Math.min(99, Math.round(100 - Number(currentLocation.accuracy))))}%`
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}