import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapLibreContainer from './MapLibreContainer'
import { CircleMarker, Polyline } from './MapLibreMarkers'
import { locationAPI } from '../services/api'
import '../styles/routehistory.css'

const SPEEDS = [1, 2, 4, 8]
function distanceKm(points) {
  let distance = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1], b = points[i]
    const dLat = (b.latitude - a.latitude) * Math.PI / 180
    const dLon = (b.longitude - a.longitude) * Math.PI / 180
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    distance += 6371 * 2 * Math.asin(Math.sqrt(x))
  }
  return distance.toFixed(2)
}

export default function RouteHistory({ userId, adminUserId = null }) {
  const targetUserId = adminUserId || userId
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetched, setFetched] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [replayIdx, setReplayIdx] = useState(0)
  const [speedIdx, setSpeedIdx] = useState(0)
  const timerRef = useRef(null)

  const fetchRoute = useCallback(async () => {
    if (!targetUserId || !date) return
    setLoading(true); setError(''); setPlaying(false); setReplayIdx(0)
    try {
      const offset = -new Date(`${date}T12:00:00`).getTimezoneOffset()
      const sign = offset >= 0 ? '+' : '-'
      const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
      const mm = String(Math.abs(offset) % 60).padStart(2, '0')
      const zone = `${sign}${hh}:${mm}`
      const start = `${date}T00:00:00${zone}`
      const end = `${date}T23:59:59.999${zone}`
      const response = adminUserId
        ? await locationAPI.getAdminUserHistory(adminUserId, start, end)
        : await locationAPI.getLocationHistory(start, end)
      const sorted = [...(response.data || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      setPoints(sorted); setFetched(true)
      if (!sorted.length) setError('No location data found for this user on this date.')
    } catch (err) {
      setPoints([]); setFetched(true)
      setError(err.response?.data?.detail || 'Failed to load route history.')
    } finally { setLoading(false) }
  }, [adminUserId, date, targetUserId])

  useEffect(() => {
    setPoints([]); setFetched(false); setError(''); setPlaying(false); setReplayIdx(0)
    clearInterval(timerRef.current)
  }, [targetUserId])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!playing || points.length < 2) return undefined
    timerRef.current = setInterval(() => setReplayIdx(index => {
      if (index >= points.length - 1) { setPlaying(false); return index }
      return index + 1
    }), 800 / SPEEDS[speedIdx])
    return () => clearInterval(timerRef.current)
  }, [playing, points.length, speedIdx])

  const positions = useMemo(() => points.map(p => [p.latitude, p.longitude]), [points])
  const shown = playing || replayIdx > 0 ? positions.slice(0, replayIdx + 1) : positions
  const current = points[replayIdx]
  const center = current ? [current.longitude, current.latitude] : [0, 20]
  const duration = points.length > 1 ? Math.max(0, Math.round((new Date(points.at(-1).timestamp) - new Date(points[0].timestamp)) / 60000)) : 0

  const progress = points.length > 1 ? replayIdx / (points.length - 1) * 100 : 0
  const formatTime = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--'

  return <div className="rh-root">
    <aside className="rh-sidebar">
      <header className="rh-sidebar-header">
        <div className="rh-logo-mark" />
        <h2 className="rh-title">Route History</h2>
        <p className="rh-subtitle">Travel timeline &amp; replay</p>
      </header>
      <div className="rh-section">
        <label className="rh-label" htmlFor="route-date">Select date</label>
        <input id="route-date" className="rh-date-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button className="rh-btn-fetch" type="button" onClick={fetchRoute} disabled={loading || !targetUserId}>
          {loading ? <><span className="rh-spinner" /> Loading…</> : '🗺 Load Route'}
        </button>
      </div>
      <div className="rh-stats">
        <div className="rh-stat"><strong className="rh-stat-val">{points.length}</strong><span className="rh-stat-label">Points</span></div>
        <div className="rh-stat"><strong className="rh-stat-val">{distanceKm(points)} km</strong><span className="rh-stat-label">Distance</span></div>
        <div className="rh-stat"><strong className="rh-stat-val">{duration} min</strong><span className="rh-stat-label">Duration</span></div>
      </div>
      {error && <div className="rh-error">{error}</div>}
      {points.length > 1 && <div className="rh-replay">
        <div className="rh-replay-header"><span className="rh-replay-title">▶ Route Replay</span><button className="rh-speed-btn" type="button" onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}>{SPEEDS[speedIdx]}×</button></div>
        <div className="rh-progress-track" onClick={e => setReplayIdx(Math.round((e.nativeEvent.offsetX / e.currentTarget.clientWidth) * (points.length - 1)))}>
          <div className="rh-progress-fill" style={{width:`${progress}%`}} />
          <div className="rh-progress-thumb" style={{left:`${progress}%`}} />
        </div>
        <div className="rh-time-row"><span>{formatTime(points[0]?.timestamp)}</span><span>{formatTime(points.at(-1)?.timestamp)}</span></div>
        <div className="rh-ctrl-row">
          <button className="rh-ctrl-btn rh-ctrl-primary" type="button" onClick={() => { if (replayIdx >= points.length - 1) setReplayIdx(0); setPlaying(v => !v) }}>{playing ? 'Ⅱ' : '▶'}</button>
          <button className="rh-ctrl-btn" type="button" onClick={() => { setPlaying(false); setReplayIdx(0) }}>↺ Reset</button>
        </div>
        {current && <div className="rh-point-detail">
          <div className="rh-kv"><span>Time</span><span>{formatTime(current.timestamp)}</span></div>
          <div className="rh-kv"><span>Latitude</span><span>{Number(current.latitude).toFixed(5)}</span></div>
          <div className="rh-kv"><span>Longitude</span><span>{Number(current.longitude).toFixed(5)}</span></div>
        </div>}
      </div>}
      {points.length > 0 ? <div className="rh-timeline">
        <span className="rh-label">Timeline</span>
        <div className="rh-timeline-list">{points.map((point, index) => <div key={point.id || `${point.timestamp}-${index}`} className={`rh-timeline-item ${index === replayIdx ? 'rh-timeline-item--active' : ''} ${index === 0 ? 'rh-timeline-item--start' : ''} ${index === points.length - 1 ? 'rh-timeline-item--end' : ''}`} onClick={() => { setPlaying(false); setReplayIdx(index) }}>
          <span className="rh-tl-dot" /><div className="rh-tl-body"><span className="rh-tl-time">{formatTime(point.timestamp)}</span><span className="rh-tl-coords">{Number(point.latitude).toFixed(4)}, {Number(point.longitude).toFixed(4)}</span></div>
          {index === 0 && <span className="rh-tl-badge rh-tl-badge--start">START</span>}{index === points.length - 1 && <span className="rh-tl-badge rh-tl-badge--end">END</span>}
        </div>)}</div>
      </div> : <div className="rh-empty">Pick a date and tap <strong>Load Route</strong> to see where you travelled.</div>}
    </aside>
    <section className="rh-map-wrap">
      <MapLibreContainer className="rh-map" center={center} zoom={current ? 15 : 2}>
        {shown.length > 1 && <Polyline positions={shown} options={{ color: '#6366f1', weight: 5, opacity: 0.9 }} />}
        {positions[0] && <CircleMarker center={positions[0]} radius={8} options={{ color: '#fff', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }} />}
        {positions.length > 1 && <CircleMarker center={positions.at(-1)} radius={8} options={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }} />}
        {current && <CircleMarker center={[current.latitude, current.longitude]} radius={11} options={{ color: '#fff', fillColor: '#6366f1', fillOpacity: 1, weight: 3 }} />}
      </MapLibreContainer>
      {positions.length > 0 && <div className="rh-legend"><div className="rh-legend-item"><span className="rh-legend-dot" style={{background:'#22c55e'}} />Start</div><div className="rh-legend-item"><span className="rh-legend-dot" style={{background:'#ef4444'}} />End</div></div>}
    </section>
  </div>
}
