import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'
import MapLibreContainer, { maplibregl } from './MapLibreContainer'
import { Polyline, CircleMarker } from './MapLibreMarkers'
import '../styles/navigate.css'
import { notificationAPI } from '../services/api'

// ── OpenRouteService (free, no billing) ───────────────────────────────────────
// Get a free API key at https://openrouteservice.org/dev/#/signup
// Set VITE_ORS_API_KEY in your .env file
// Falls back to OSRM (open, no key needed) if no ORS key provided
const ORS_KEY = import.meta.env.VITE_ORS_API_KEY || ''


// ── Routing via OSRM (no key) or ORS (free key) ───────────────────────────────
async function fetchRoute(originLat, originLon, destLat, destLon) {
  console.log("Origin:", originLat, originLon);
console.log("Destination:", destLat, destLon);

if (
    !originLat ||
    !originLon ||
    !destLat ||
    !destLon
) {
    throw new Error("Invalid GPS Coordinates");
}
  if (ORS_KEY) {
    // OpenRouteService — driving-car profile, GeoJSON
    const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`
    console.log("OSRM URL:", url);
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [[originLon, originLat], [destLon, destLat]],
        instructions: true,
      }),
    })
    if (!res.ok) throw new Error(`ORS error ${res.status}`)
    const json = await res.json()
    const feature  = json.features[0]
    const coords   = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon])
    const summary  = feature.properties.summary
    const segments = feature.properties.segments[0]?.steps || []
    const steps    = segments.map((s) => ({
      instruction: s.instruction,
      distance:    s.distance,
      duration:    s.duration,
    }))
    return {
      polyline:     coords,
      distanceKm:   (summary.distance / 1000).toFixed(1),
      durationMin:  Math.round(summary.duration / 60),
      steps,
    }
  }

  // Fallback: OSRM public demo server (driving, no key needed)
  const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`OSRM error ${res.status}`)
  const json  = await res.json()
  if (json.code !== 'Ok') throw new Error(json.message || 'No route found')
  const route    = json.routes[0]
  const coords   = route.geometry.coordinates.map(([lon, lat]) => [lat, lon])
  const steps    = route.legs[0]?.steps?.map((s) => ({
    instruction: s.maneuver?.type
      ? `${s.maneuver.type.replace(/_/g, ' ')} — ${s.name || 'unnamed road'}`
      : (s.name || 'Continue'),
    distance:  s.distance,
    duration:  s.duration,
  })) || []
  return {
    polyline:    coords,
    distanceKm:  (route.distance / 1000).toFixed(1),
    durationMin: Math.round(route.duration / 60),
    steps,
  }
}

// ── Geocode a place name → {lat, lon, label} ──────────────────────────────────
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error('Geocode failed')
  const json = await res.json()
  return json.map((r) => ({
    lat:   parseFloat(r.lat),
    lon:   parseFloat(r.lon),
    label: r.display_name,
  }))
}

// ── Haversine bearing (degrees) ───────────────────────────────────────────────
function bearing(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180
  const dLon = (lon2 - lon1) * toR
  const y = Math.sin(dLon) * Math.cos(lat2 * toR)
  const x = Math.cos(lat1 * toR) * Math.sin(lat2 * toR) -
            Math.sin(lat1 * toR) * Math.cos(lat2 * toR) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

// ── Distance between two [lat, lon] points in metres ─────────────────────────
function distM(a, b) {
  const R = 6371000
  const toR = Math.PI / 180
  const dLat = (b[0] - a[0]) * toR
  const dLon = (b[1] - a[1]) * toR
  const x = Math.sin(dLat/2)**2 + Math.cos(a[0]*toR)*Math.cos(b[0]*toR)*Math.sin(dLon/2)**2
  return R * 2 * Math.asin(Math.sqrt(x))
}

// Find the closest point index on the route polyline to the user
function closestIdx(polyline, pos) {
  let best = 0, bestD = Infinity
  polyline.forEach(([la, lo], i) => {
    const d = distM([la, lo], pos)
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

// ── Status phases ─────────────────────────────────────────────────────────────
const PHASE = { IDLE: 'idle', SEARCHING: 'searching', PREVIEW: 'preview', NAVIGATING: 'navigating', ARRIVED: 'arrived' }

export default function NavigationView({ voiceSearchRequest = null }) {
  const [phase,        setPhase]        = useState(PHASE.IDLE)
  const [query,        setQuery]        = useState('')
  const [suggestions,  setSuggestions]  = useState([])
  const [destination,  setDestination]  = useState(null)   // {lat, lon, label}
  const [origin,       setOrigin]       = useState(null)   // [lat, lon]
  const [route,        setRoute]        = useState(null)   // {polyline, distanceKm, durationMin, steps}
  const [userPos,      setUserPos]      = useState(null)   // [lat, lon]
  const [heading,      setHeading]      = useState(0)
  const [routeIdx,     setRouteIdx]     = useState(0)      // closest point on route
  const [currentStep,  setCurrentStep]  = useState(0)
  const [distLeft,     setDistLeft]     = useState(null)
  const [eta,          setEta]          = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [error,        setError]        = useState('')
  const [geoLoading,   setGeoLoading]   = useState(false)
  const [showSteps,    setShowSteps]    = useState(false)
  const [mapFollow,    setMapFollow]    = useState(true)

  const watchRef      = useRef(null)
  const debounceRef   = useRef(null)
  const suggestRef    = useRef(null)
  const inputRef      = useRef(null)
  const arrivalReportedRef = useRef(false)
  const mapRef        = useRef(null)

  // ── Get current GPS position once ─────────────────────────────────────────
  const getCurrentPos = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      (e) => reject(new Error({ 1: 'Location denied', 2: 'Position unavailable', 3: 'GPS timeout' }[e.code] || 'GPS error')),
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 10000 }
    )
  }), [])

  // ── Autocomplete search ────────────────────────────────────────────────────
  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setError('')
    clearTimeout(debounceRef.current)
    if (val.trim().length < 3) { setSuggestions([]); return }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocode(val)
        setSuggestions(results.slice(0, 5))
      } catch { /* ignore */ }
    }, 400)
  }

  // ── Select a suggestion ────────────────────────────────────────────────────
  const handleSelect = (place) => {
    setDestination(place)
    setQuery(place.label.split(',').slice(0, 2).join(','))
    setSuggestions([])
    setPhase(PHASE.IDLE)
  }

  // ── Load route ─────────────────────────────────────────────────────────────
  const loadRouteFor = useCallback(async (place = destination) => {
    if (!place) { setError('Enter a destination first'); return }
    setRouteLoading(true)
    setError('')
    try {
      setGeoLoading(true)
      const pos = await getCurrentPos()
      setGeoLoading(false)
      setOrigin(pos)
      setUserPos(pos)

      const r = await fetchRoute(pos[0], pos[1], place.lat, place.lon)
      setRoute(r)
      setRouteIdx(0)
      setCurrentStep(0)
      setDistLeft(r.distanceKm)
      setEta(r.durationMin)
      setPhase(PHASE.PREVIEW)
    } catch (err) {
      setError(err.message || 'Could not load route')
      setGeoLoading(false)
    } finally {
      setRouteLoading(false)
    }
  }, [destination, getCurrentPos])

  const handleLoadRoute = useCallback(() => loadRouteFor(destination), [destination, loadRouteFor])

  // ── Start navigation ───────────────────────────────────────────────────────
  const startNavigation = useCallback(() => {
    if (!route) return
    arrivalReportedRef.current = false
    setPhase(PHASE.NAVIGATING)
    setMapFollow(true)

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p   = [pos.coords.latitude, pos.coords.longitude]
        const hdg = pos.coords.heading ?? bearing(userPos?.[0] ?? p[0], userPos?.[1] ?? p[1], p[0], p[1])
        setUserPos(p)
        setHeading(hdg || 0)

        if (route) {
          const idx = closestIdx(route.polyline, p)
          setRouteIdx(idx)

          // remaining distance from current point to end
          let rem = 0
          for (let i = idx; i < route.polyline.length - 1; i++) {
            rem += distM(route.polyline[i], route.polyline[i + 1])
          }
          setDistLeft((rem / 1000).toFixed(1))

          // crude ETA: remaining km / assumed 40km/h
          const speed = pos.coords.speed || 11.1  // m/s default 40km/h
          setEta(Math.round(rem / speed / 60))

          // Advance step based on route progress
          if (route.steps.length > 0) {
            const stepsCount = route.steps.length
            const stepIdx    = Math.min(Math.floor((idx / route.polyline.length) * stepsCount), stepsCount - 1)
            setCurrentStep(stepIdx)
          }

          // Arrived check: within 30 m of destination
          const dest = route.polyline[route.polyline.length - 1]
          if (distM(p, dest) < 30) {
            setPhase(PHASE.ARRIVED)
            navigator.geolocation.clearWatch(watchRef.current)
            if (!arrivalReportedRef.current) {
              arrivalReportedRef.current = true
              notificationAPI.createEvent({
                type: 'destination_reached',
                latitude: p[0],
                longitude: p[1],
                metadata: { destination: destination?.label || 'Destination' },
              }).catch(() => {})
            }
          }
        }
      },
      (err) => setError({ 1: 'Location denied', 2: 'Position unavailable', 3: 'GPS timeout' }[err.code] || 'GPS error'),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    )
  }, [route, userPos, destination])

  // ── Stop navigation ────────────────────────────────────────────────────────
  const stopNavigation = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    setPhase(PHASE.IDLE)
    setRoute(null)
    setDestination(null)
    setQuery('')
    setOrigin(null)
    setUserPos(null)
    setDistLeft(null)
    setEta(null)
    setCurrentStep(0)
    setRouteIdx(0)
  }, [])

  // Close suggestion list on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) setSuggestions([])
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    clearTimeout(debounceRef.current)
  }, [])

  useEffect(() => {
    const voiceDestination = voiceSearchRequest?.destination || ''
    if (!voiceDestination) return
    let cancelled = false

    const run = async () => {
      setQuery(voiceDestination)
      setSuggestions([])
      setError('')
      try {
        setGeoLoading(true)
        const results = await geocode(voiceDestination)
        if (cancelled) return
        const place = results[0]
        if (!place) {
          setError(`No destination found for "${voiceDestination}"`)
          return
        }
        setDestination(place)
        setSuggestions(results.slice(0, 5))
        setPhase(PHASE.PREVIEW)
        if (voiceSearchRequest?.autoStart) {
          await loadRouteFor(place)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not search destination')
      } finally {
        if (!cancelled) setGeoLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [voiceSearchRequest, loadRouteFor])

  // ── Derived map state ──────────────────────────────────────────────────────
  const mapCenter   = userPos ? [userPos[1], userPos[0]] : (origin ? [origin[1], origin[0]] : [78, 20])  // [lng, lat]
  const mapZoom     = phase === PHASE.NAVIGATING ? 17 : 13
  const panPosition = mapFollow && userPos ? [userPos[1], userPos[0]] : null  // [lng, lat]

  // Remaining route polyline (grey ahead, white trail behind)
  const trailLine   = route?.polyline.slice(0, routeIdx + 1)   || []
  const aheadLine   = route?.polyline.slice(routeIdx)          || []

  const currentInstruction = route?.steps[currentStep]?.instruction || ''
  const nextInstruction    = route?.steps[currentStep + 1]?.instruction || ''

  const formatDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="nav-root">

      {/* ── Map ── */}
      <div className="nav-map-wrap">
        <MapLibreContainer
          center={mapCenter}
          zoom={mapZoom}
          style="streets-v2-dark"
          className="nav-map"
          onMapLoad={(map) => {
            mapRef.current = map
            // Pan to user when navigating
            if (panPosition && phase === PHASE.NAVIGATING) {
              map.flyTo({ center: panPosition, zoom: 17, duration: 600 })
            }
            // Fit whole route on preview
            if (phase === PHASE.PREVIEW && route && route.polyline.length > 1) {
              const bounds = route.polyline.reduce((b, [lat, lon]) => {
                if (!b) return { minLng: lon, maxLng: lon, minLat: lat, maxLat: lat }
                return {
                  minLng: Math.min(b.minLng, lon),
                  maxLng: Math.max(b.maxLng, lon),
                  minLat: Math.min(b.minLat, lat),
                  maxLat: Math.max(b.maxLat, lat),
                }
              }, null)
              if (bounds) {
                map.fitBounds([
                  [bounds.minLng, bounds.minLat],
                  [bounds.maxLng, bounds.maxLat],
                ], { padding: 60 })
              }
            }
          }}
        >
          {/* Completed trail */}
          {trailLine.length > 1 && (
            <Polyline
              map={mapRef.current}
              positions={trailLine}
              options={{ color: 'rgba(255,255,255,0.25)', weight: 5 }}
            />
          )}

          {/* Remaining route */}
          {aheadLine.length > 1 && (
            <Polyline
              map={mapRef.current}
              positions={aheadLine}
              options={{ color: '#6366f1', weight: 6 }}
            />
          )}

          {/* User position — pulsing blue dot */}
          {userPos && (
            <CircleMarker
              map={mapRef.current}
              center={userPos}
              radius={10}
              options={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}
            />
          )}

          {/* Destination pin */}
          {destination && (
            <CircleMarker
              map={mapRef.current}
              center={[destination.lat, destination.lon]}
              radius={10}
              options={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 3 }}
            />
          )}
        </MapLibreContainer>

        {/* ── Navigating HUD overlaid on map ── */}
        {phase === PHASE.NAVIGATING && (
          <>
            {/* Top instruction banner */}
            <div className="nav-instruction-bar">
              <div className="nav-instruction-icon">➡</div>
              <div className="nav-instruction-text">
                <div className="nav-instruction-main">{currentInstruction || 'Follow the route'}</div>
                {nextInstruction && (
                  <div className="nav-instruction-next">Then: {nextInstruction}</div>
                )}
              </div>
            </div>

            {/* Bottom info strip */}
            <div className="nav-info-strip">
              <div className="nav-info-item">
                <span className="nav-info-val">{distLeft} km</span>
                <span className="nav-info-label">Remaining</span>
              </div>
              <div className="nav-info-divider" />
              <div className="nav-info-item">
                <span className="nav-info-val">{eta} min</span>
                <span className="nav-info-label">ETA</span>
              </div>
              <div className="nav-info-divider" />
              <div className="nav-info-item">
                <span className="nav-info-val nav-dest-name">{destination?.label.split(',')[0]}</span>
                <span className="nav-info-label">Destination</span>
              </div>
              <button className="nav-stop-btn" onClick={stopNavigation}>✕ End</button>
            </div>

            {/* Map follow toggle */}
            <button
              className={`nav-follow-btn ${mapFollow ? 'nav-follow-btn--on' : ''}`}
              onClick={() => setMapFollow((v) => !v)}
              title={mapFollow ? 'Following you — tap to unlock map' : 'Map unlocked — tap to re-center'}
            >
              {mapFollow ? '🔒' : '🔓'}
            </button>
          </>
        )}

        {/* Arrived overlay */}
        {phase === PHASE.ARRIVED && (
          <div className="nav-arrived-overlay">
            <div className="nav-arrived-card">
              <div className="nav-arrived-icon">🏁</div>
              <h2>You have arrived!</h2>
              <p>{destination?.label.split(',')[0]}</p>
              <button className="nav-arrived-btn" onClick={stopNavigation}>Done</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Side panel ── */}
      {phase !== PHASE.NAVIGATING && phase !== PHASE.ARRIVED && (
        <div className="nav-panel">
          <div className="nav-panel-header">
            <div className="nav-panel-mark" />
            <h2 className="nav-panel-title">Navigation</h2>
            <p className="nav-panel-sub">Enter a destination to get directions</p>
          </div>

          {/* Search box */}
          <div className="nav-search-wrap" ref={suggestRef}>
            <div className="nav-search-row">
              <div className="nav-search-icon">🔍</div>
              <input
                ref={inputRef}
                className="nav-search-input"
                placeholder="Where do you want to go?"
                value={query}
                onChange={handleQueryChange}
                onFocus={() => setPhase(PHASE.SEARCHING)}
              />
              {query && (
                <button className="nav-search-clear" onClick={() => {
                  setQuery(''); setSuggestions([]); setDestination(null); setRoute(null); setPhase(PHASE.IDLE)
                }}>×</button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="nav-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="nav-suggestion-item" onClick={() => handleSelect(s)}>
                    <span className="nav-suggest-icon">📍</span>
                    <span className="nav-suggest-text">
                      <span className="nav-suggest-primary">{s.label.split(',')[0]}</span>
                      <span className="nav-suggest-secondary">{s.label.split(',').slice(1, 3).join(',')}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="nav-error">{error}</div>}

          {/* Destination confirmed */}
          {destination && phase !== PHASE.SEARCHING && (
            <div className="nav-dest-card">
              <div className="nav-dest-row">
                <span className="nav-dest-icon">🏁</span>
                <div className="nav-dest-info">
                  <div className="nav-dest-primary">{destination.label.split(',')[0]}</div>
                  <div className="nav-dest-secondary">{destination.label.split(',').slice(1, 3).join(',')}</div>
                </div>
              </div>

              {/* Route summary */}
              {route && (
                <div className="nav-route-summary">
                  <div className="nav-route-stat">
                    <span className="nav-route-val">{route.distanceKm} km</span>
                    <span className="nav-route-label">Distance</span>
                  </div>
                  <div className="nav-route-divider" />
                  <div className="nav-route-stat">
                    <span className="nav-route-val">{route.durationMin} min</span>
                    <span className="nav-route-label">Est. time</span>
                  </div>
                  <div className="nav-route-divider" />
                  <div className="nav-route-stat">
                    <span className="nav-route-val">{route.steps.length}</span>
                    <span className="nav-route-label">Turns</span>
                  </div>
                </div>
              )}

              {/* Get route / Start navigation buttons */}
              <div className="nav-actions">
                {!route ? (
                  <button className="nav-btn-route" onClick={handleLoadRoute} disabled={routeLoading}>
                    {geoLoading ? '📡 Getting location…' : routeLoading ? '🗺 Loading route…' : '🗺 Get Route'}
                  </button>
                ) : (
                  <>
                    <button className="nav-btn-start" onClick={startNavigation}>
                      ▶ Start Navigation
                    </button>
                    <button className="nav-btn-reroute" onClick={handleLoadRoute} disabled={routeLoading}>
                      🔄 Recalculate
                    </button>
                  </>
                )}
              </div>

              {/* Turn-by-turn steps */}
              {route && route.steps.length > 0 && (
                <div className="nav-steps-section">
                  <button className="nav-steps-toggle" onClick={() => setShowSteps((v) => !v)}>
                    {showSteps ? '▲ Hide steps' : `▼ Show ${route.steps.length} steps`}
                  </button>
                  {showSteps && (
                    <div className="nav-steps-list">
                      {route.steps.map((step, i) => (
                        <div key={i} className="nav-step">
                          <div className="nav-step-num">{i + 1}</div>
                          <div className="nav-step-body">
                            <div className="nav-step-instruction">{step.instruction}</div>
                            <div className="nav-step-dist">{formatDist(step.distance)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!destination && phase !== PHASE.SEARCHING && (
            <div className="nav-hint">
              <div className="nav-hint-icon">🗺</div>
              <p>Search for a place, landmark, or address to get directions from your current location.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}