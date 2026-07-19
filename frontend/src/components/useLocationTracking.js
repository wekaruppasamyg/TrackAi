/**
 * useLocationTracking
 * --------------------
 * Fully live GPS tracking — replaces the old "capture + send every 15s"
 * approach with navigator.geolocation.watchPosition, which pushes a new
 * fix to the callback as soon as the OS/browser has one (no fixed
 * interval, no batching, no throttling).
 *
 * Every fix that comes in is POSTed to the backend immediately. The
 * backend (realtime.py -> broadcast_location_update) already broadcasts
 * every saved Location over WebSocket to both the admin pool and the
 * user's own pool, so nothing on the server needs to change — the map
 * just gets updates as fast as the device produces them.
 *
 * Drop this in wherever LocationTracker.jsx is rendered, e.g.:
 *
 *   const tracking = useLocationTracking()
 *   <LocationTracker
 *     wsStatus={tracking.wsStatus}
 *     accuracy={tracking.accuracy}
 *     message={tracking.message}
 *     isTracking={tracking.isTracking}
 *     onStart={tracking.start}
 *     onStop={tracking.stop}
 *     isConsent={isConsent}
 *   />
 */

import { useCallback, useRef, useState } from 'react'
import { locationAPI } from '../services/api'
import { useLocationStore } from '../store'

// ── Movement threshold ───────────────────────────────────────────────────
// "Fully live" means every real movement is sent instantly — it does NOT
// mean spamming the server every time watchPosition fires with a fix
// that's 0.3m away from the last one (GPS jitter does this constantly,
// even standing still). We only skip a send when BOTH are true:
//   - moved less than MIN_MOVE_METERS since the last successful send, AND
//   - less than MAX_SILENCE_MS have passed since the last successful send
// So a genuinely stationary device still sends a heartbeat every
// MAX_SILENCE_MS (keeps "last seen" fresh / staleness checks honest), and
// any real movement — even 1m over the threshold — sends immediately.
const MIN_MOVE_METERS = 8
const MAX_SILENCE_MS  = 20_000
const EARTH_RADIUS_M  = 6_371_000

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useLocationTracking() {
  const [isTracking, setIsTracking] = useState(false)
  const [wsStatus, setWsStatus]     = useState('idle') // idle | connecting | live | disconnected
  const [accuracy, setAccuracy]     = useState(null)
  const [message, setMessage]       = useState('')

  const watchIdRef   = useRef(null)
  const sendingRef   = useRef(false) // simple in-flight guard so slow POSTs don't pile up
  const lastSentRef  = useRef(null)  // { lat, lng, atMs } of last successful send

  const sendFix = useCallback(async (pos) => {
    const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords

    // Don't queue a new send while a previous one is still in flight —
    // just drop this fix and let the next watchPosition callback (which
    // will already be a fresher position) go through instead.
    if (sendingRef.current) return

    // Throttle: skip only if barely moved AND it's been a short time.
    const last = lastSentRef.current
    if (last) {
      const movedM    = haversineMeters(last.lat, last.lng, latitude, longitude)
      const elapsedMs = Date.now() - last.atMs
      if (movedM < MIN_MOVE_METERS && elapsedMs < MAX_SILENCE_MS) {
        return // stationary — save the network/DB write, nothing visually changes anyway
      }
    }

    sendingRef.current = true

    try {
      const saved = await locationAPI.createLocation({
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
      })
      lastSentRef.current = { lat: latitude, lng: longitude, atMs: Date.now() }
      setWsStatus('live')
      setAccuracy(accuracy != null ? Math.round(accuracy) : null)
      setMessage('')

      // Mirror into the shared Zustand store immediately (don't wait for
      // the WS round-trip) so every page reading useLocationStore —
      // MapDashboard, Navigation, etc — reflects this fix right away.
      // The WS broadcast will arrive a moment later and is harmless to
      // apply again (same data), it's just belt-and-suspenders for the
      // admin side and other browser tabs.
      const fresh = saved?.data || {
        latitude, longitude, accuracy, altitude, speed, heading,
        timestamp: new Date().toISOString(),
      }
      useLocationStore.setState((s) => ({
        currentLocation: fresh,
        locations: [fresh, ...(s.locations || [])].slice(0, 500),
      }))
    } catch (err) {
      setWsStatus('disconnected')
      setMessage(`Save error: ${err?.message || 'could not reach server'}`)
    } finally {
      sendingRef.current = false
    }
  }, [])

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setMessage('GPS Error: geolocation not supported on this device')
      return
    }
    if (watchIdRef.current != null) return // already tracking

    setWsStatus('connecting')
    setMessage('')

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setIsTracking(true)
        sendFix(pos)
      },
      (err) => {
        setWsStatus('disconnected')
        setMessage(`GPS Error: ${err.message}`)
      },
      {
        enableHighAccuracy: true, // use GPS chip, not cell/wifi triangulation
        maximumAge: 0,            // never reuse a stale cached fix — always the latest one
        timeout: 15000,
      }
    )
  }, [sendFix])

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    lastSentRef.current = null // next start() always sends the first fix immediately
    setIsTracking(false)
    setWsStatus('idle')
    setMessage('')
  }, [])

  return { isTracking, wsStatus, accuracy, message, start, stop }
}