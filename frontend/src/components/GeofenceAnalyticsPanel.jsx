import React, { useEffect, useMemo, useState } from 'react'
import { notificationAPI } from '../services/api'

function parseMeta(n) {
  try { return n.metadata_json ? JSON.parse(n.metadata_json) : {} } catch { return {} }
}

// FastAPI error responses come in two shapes:
//  - a plain string, from `raise HTTPException(detail="...")`
//  - an ARRAY of validation-error objects ({type, loc, msg, input, ctx, url}),
//    from pydantic query/body validation failures (e.g. limit too high)
// Rendering the array directly as a React child crashes the tree, so this
// always reduces it to a plain string first.
function toErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msg = detail.map((d) => d?.msg).filter(Boolean).join('; ')
    return msg || fallback
  }
  return fallback
}

function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const RANGE_DAYS = { '7d': 7, '30d': 30, all: 3650 }
const EARTH_RADIUS_M = 6_371_000
const STALE_MS = 300_000

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Tiny zero-dependency SVG bar chart ──────────────────────────────────────
function BarChart({ series, height = 160, colorA = '#6366f1', colorB = '#22c55e', labelA = 'Entries', labelB = 'Exits' }) {
  const max = Math.max(1, ...series.map((s) => Math.max(s.a, s.b)))
  const barW = 14
  const gap = 10
  const groupW = barW * 2 + 6
  const width = Math.max(320, series.length * (groupW + gap))

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height + 40} style={{ display: 'block' }}>
        {series.map((s, i) => {
          const x = i * (groupW + gap)
          const hA = (s.a / max) * height
          const hB = (s.b / max) * height
          return (
            <g key={s.key} transform={`translate(${x},0)`}>
              <rect x={0} y={height - hA} width={barW} height={hA} rx={3} fill={colorA} opacity={0.9} />
              <rect x={barW + 6} y={height - hB} width={barW} height={hB} rx={3} fill={colorB} opacity={0.9} />
              <text x={groupW / 2} y={height + 16} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)">
                {s.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: colorA, marginRight: 5 }} />{labelA}</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: colorB, marginRight: 5 }} />{labelB}</span>
      </div>
    </div>
  )
}

function HBarChart({ items, color = '#8b5cf6' }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => (
        <div key={item.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>{item.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.count}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(item.count / max) * 100}%`, background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function StatBlock({ icon, value, label, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`, borderRadius: 16,
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  )
}

export default function GeofenceAnalyticsPanel({ users, geofences, activeUsersCount = 0, liveNotifications = [] }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [range, setRange]     = useState('7d')

  const usersById     = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const geofencesById  = useMemo(() => new Map(geofences.map((g) => [g.id, g])), [geofences])

  const load = async () => {
    setLoading(true); setError('')
    try {
      let res
      try {
        res = await notificationAPI.list(500)
      } catch (err) {
        // Backend caps the page size lower than 500 — fall back automatically
        // instead of surfacing a raw validation error to the user.
        if (err.response?.status === 422) {
          res = await notificationAPI.list(100)
        } else {
          throw err
        }
      }
      setNotifications(res.data || [])
    } catch (e) {
      setError(toErrorMessage(e, 'Failed to load alert history'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Real-time: merge in any notification that arrives live over the
  // WebSocket (passed down from AdminDashboard's already-live `notifications`
  // state — the same stream that drives the bell icon) on top of the
  // historical page loaded above, deduped by id. This is what makes
  // Total Entries / Total Exits / the charts update themselves the instant
  // a geofence crossing happens, instead of requiring a manual refresh.
  useEffect(() => {
    if (liveNotifications.length === 0) return
    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id))
      const newOnes = liveNotifications.filter((n) => n?.id && !existingIds.has(n.id))
      if (newOnes.length === 0) return prev
      return [...newOnes, ...prev]
    })
  }, [liveNotifications])

  // Diagnostic aid — open the browser console to see exactly what `type`
  // values your backend is actually sending, if entries/exits still show 0.
  useEffect(() => {
    if (notifications.length === 0) return
    const distinctTypes = [...new Set(notifications.map((n) => n.type))]
    console.info('[GeofenceAnalytics] loaded', notifications.length, 'notifications — distinct types:', distinctTypes)
  }, [notifications])

  const cutoff = useMemo(() => Date.now() - RANGE_DAYS[range] * 86_400_000, [range])

  const relevant = useMemo(() => {
    return notifications.filter((n) => {
      const t = (n.type || '').toLowerCase().trim()
      const isGeoOrSos = t.startsWith('geofence_') || t.startsWith('geofence.') || t === 'sos_activated' || t === 'sos'
      if (!isGeoOrSos) return false
      return new Date(n.created_at).getTime() >= cutoff
    })
  }, [notifications, cutoff])

  const sos     = useMemo(() => relevant.filter((n) => {
    const t = (n.type || '').toLowerCase()
    return t.includes('sos')
  }), [relevant])

  // ── Live "currently inside" entries ─────────────────────────────────────
  // A recorded geofence_enter event only exists if the backend actually saw
  // an outside→inside transition. If a user was already inside a zone
  // before tracking/analytics started watching (or their very first-ever
  // ping landed inside), no transition was ever logged — even though
  // they're demonstrably inside right now (same check the map's "Zone
  // occupied" badge uses). The entries computation below fills that gap:
  // for every active geofence whose assigned user is currently live and
  // inside it, and who doesn't already have a real recorded entry for it
  // in this range, it counts one "live" entry so the number reflects
  // current reality immediately instead of waiting for a future crossing.

  const entries = useMemo(() => {
    const historical = relevant.filter((n) => {
      const t = (n.type || '').toLowerCase()
      return t.includes('geofence') && t.includes('enter')
    })

    const recordedPairs = new Set(
      historical.map((n) => `${n.user_id}::${parseMeta(n).geofence_id || ''}`)
    )

    const now = Date.now()
    const liveOnly = []
    geofences.forEach((gf) => {
      if (!gf.is_active) return
      const owner = users.find((u) => u.id === gf.user_id)
      const loc = owner?.last_location
      if (!owner || !loc?.latitude || !loc?.longitude) return
      const ts = loc.timestamp ? new Date(loc.timestamp).getTime() : null
      const isLive = ts ? now - ts <= STALE_MS : false
      if (!isLive) return
      const distance = haversineMeters(Number(loc.latitude), Number(loc.longitude), Number(gf.latitude), Number(gf.longitude))
      if (distance > Number(gf.radius)) return
      const pairKey = `${gf.user_id}::${gf.id}`
      if (recordedPairs.has(pairKey)) return // already has a real recorded entry — don't double count
      liveOnly.push({
        id: `live-enter-${gf.id}-${owner.id}`,
        type: 'geofence_enter',
        user_id: owner.id,
        created_at: loc.timestamp || new Date().toISOString(),
        message: `${owner.username || 'A user'} is currently inside ${gf.name}.`,
        metadata_json: JSON.stringify({ geofence_id: gf.id, geofence_name: gf.name }),
        _live: true,
      })
    })

    return [...historical, ...liveOnly]
  }, [relevant, geofences, users])

  const exits   = useMemo(() => relevant.filter((n) => {
    const t = (n.type || '').toLowerCase()
    return t.includes('geofence') && t.includes('exit')
  }), [relevant])

  const zoneName = (n) => {
    const meta = parseMeta(n)
    if (meta.geofence_name) return meta.geofence_name
    const gf = geofencesById.get(meta.geofence_id)
    return gf?.name || 'Unknown zone'
  }
  const isRestricted = (name) => /restrict/i.test(name || '')

  const mostVisited = useMemo(() => {
    const counts = new Map()
    entries.forEach((n) => {
      const name = zoneName(n)
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [entries, geofencesById])

  const avgDwellMinutes = useMemo(() => {
    const byKey = new Map()
    const push = (n, kind) => {
      const meta = parseMeta(n)
      const key = `${n.user_id}::${meta.geofence_id || 'unknown'}`
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push({ kind, ts: new Date(n.created_at).getTime() })
    }
    entries.forEach((n) => push(n, 'enter'))
    exits.forEach((n) => push(n, 'exit'))

    const durations = []
    byKey.forEach((events) => {
      events.sort((a, b) => a.ts - b.ts)
      let openEnter = null
      events.forEach((e) => {
        if (e.kind === 'enter') openEnter = e.ts
        else if (e.kind === 'exit' && openEnter != null) {
          durations.push(e.ts - openEnter)
          openEnter = null
        }
      })
    })
    if (durations.length === 0) return 0
    return durations.reduce((a, b) => a + b, 0) / durations.length / 60000
  }, [entries, exits])

  const chartSeries = useMemo(() => {
    const days = Math.min(RANGE_DAYS[range], 30)
    const buckets = new Map()
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(Date.now() - i * 86_400_000)
      buckets.set(key, { key, label: dayLabel(key), a: 0, b: 0 })
    }
    entries.forEach((n) => {
      const key = dayKey(n.created_at)
      if (buckets.has(key)) buckets.get(key).a++
    })
    exits.forEach((n) => {
      const key = dayKey(n.created_at)
      if (buckets.has(key)) buckets.get(key).b++
    })
    return [...buckets.values()]
  }, [entries, exits, range])

  const alertHistory = useMemo(() => {
    const liveOnes = entries.filter((n) => n._live)
    return [...relevant, ...liveOnes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100)
  }, [relevant, entries])

  const eventLabel = (n) => {
    const t = (n.type || '').toLowerCase()
    if (t.includes('sos')) return { text: 'SOS', color: '#ef4444' }
    if (t.includes('geofence') && t.includes('enter')) {
      const base = isRestricted(zoneName(n)) ? 'Entered restricted area' : 'Entered geofence'
      return { text: n._live ? `${base} (live)` : base, color: n._live ? '#38bdf8' : '#22c55e' }
    }
    if (t.includes('geofence') && t.includes('exit')) return { text: 'Exited geofence', color: '#6b7280' }
    return { text: n.type, color: '#6366f1' }
  }

  const exportCSV = () => {
    const header = ['Time', 'Event', 'User', 'Zone', 'Message']
    const rows = alertHistory.map((n) => {
      const owner = usersById.get(n.user_id)
      return [
        new Date(n.created_at).toLocaleString(),
        eventLabel(n).text,
        owner?.username || n.user_id || '',
        zoneName(n),
        (n.message || '').replace(/[\r\n,]+/g, ' '),
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `geofence-alerts-${range}-${dayKey(Date.now())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const win = window.open('', '_blank', 'width=900,height=1000')
    if (!win) return
    const rowsHtml = alertHistory.map((n) => {
      const owner = usersById.get(n.user_id)
      const ev = eventLabel(n)
      return `<tr>
        <td>${new Date(n.created_at).toLocaleString()}</td>
        <td style="color:${ev.color};font-weight:600;">${ev.text}</td>
        <td>${owner?.username || n.user_id || ''}</td>
        <td>${zoneName(n)}</td>
      </tr>`
    }).join('')

    win.document.write(`
      <html>
        <head>
          <title>Geofence Analytics Report</title>
          <style>
            body { font-family: -apple-system, Arial, sans-serif; color:#111; padding: 32px; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .sub { color:#666; font-size: 12px; margin-bottom: 24px; }
            .stats { display:flex; gap:16px; margin-bottom: 24px; flex-wrap:wrap; }
            .stat { border:1px solid #ddd; border-radius:8px; padding:12px 16px; min-width:140px; }
            .stat .v { font-size:22px; font-weight:800; }
            .stat .l { font-size:11px; color:#666; margin-top:2px; }
            table { width:100%; border-collapse: collapse; font-size: 12px; }
            th, td { text-align:left; padding:8px 10px; border-bottom:1px solid #eee; }
            th { background:#f5f5f7; }
          </style>
        </head>
        <body>
          <h1>Geofence Analytics Report</h1>
          <div class="sub">Range: ${range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'All time'} · Generated ${new Date().toLocaleString()}</div>
          <div class="stats">
            <div class="stat"><div class="v">${entries.length}</div><div class="l">Total Entries</div></div>
            <div class="stat"><div class="v">${exits.length}</div><div class="l">Total Exits</div></div>
            <div class="stat"><div class="v">${activeUsersCount}</div><div class="l">Active Users</div></div>
            <div class="stat"><div class="v">${avgDwellMinutes.toFixed(1)} min</div><div class="l">Avg Time Spent</div></div>
            <div class="stat"><div class="v">${sos.length}</div><div class="l">SOS Alerts</div></div>
          </div>
          <h3>Alert History</h3>
          <table>
            <thead><tr><th>Time</th><th>Event</th><th>User</th><th>Zone</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const inputStyle = {
    padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All Time']].map(([val, label]) => (
            <button key={val} onClick={() => setRange(val)} style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: range === val ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.04)',
              color: range === val ? '#fff' : 'rgba(255,255,255,0.5)',
              border: range === val ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={inputStyle}>🔄 Refresh</button>
          <button onClick={exportCSV} style={inputStyle}>⬇ Export CSV (Excel)</button>
          <button onClick={exportPDF} style={inputStyle}>🖨 Export PDF</button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && notifications.length > 0 && relevant.length === 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#fbbf24' }}>
          Loaded {notifications.length} notifications, but none are geofence or SOS events in this range. Open the browser console to see the actual notification <code>type</code> values found — if geofence events use a different naming convention than <code>geofence_enter</code>/<code>geofence_exit</code>, let me know and I'll adjust the matching.
        </div>
      )}

      {/* Stats */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
        Total Entries includes users currently sitting inside an active zone right now, even if no crossing was recorded yet — labeled "(live)" in Alert History below.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }} className="admin-stats-grid">
        <StatBlock icon="➡️" value={entries.length} label="Total Entries" color="#22c55e" />
        <StatBlock icon="⬅️" value={exits.length} label="Total Exits" color="#6b7280" />
        <StatBlock icon="📡" value={activeUsersCount} label="Active Users" color="#6366f1" />
        <StatBlock icon="⏱" value={`${avgDwellMinutes.toFixed(1)} min`} label="Avg Time Spent" color="#f59e0b" />
        <StatBlock icon="🆘" value={sos.length} label="SOS Alerts" color="#ef4444" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }} className="admin-stats-grid">
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Entries vs Exits</div>
          {loading ? <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</div> : <BarChart series={chartSeries} />}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Most Visited Geofences</div>
          {mostVisited.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No visits recorded yet</div>
          ) : <HBarChart items={mostVisited} />}
        </div>
      </div>

      {/* Alert history */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Alert History</div>
          <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: 20, color: 'rgba(255,255,255,0.5)' }}>
            {alertHistory.length} events
          </div>
        </div>
        {loading && alertHistory.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        ) : alertHistory.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No geofence or SOS events in this range</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: '#12121a' }}>
                  {['Time', 'Event', 'User', 'Zone'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertHistory.map((n) => {
                  const owner = usersById.get(n.user_id)
                  const ev = eventLabel(n)
                  return (
                    <tr key={n.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: ev.color }}>{ev.text}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#fff' }}>{owner?.username || n.user_id || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{zoneName(n)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}