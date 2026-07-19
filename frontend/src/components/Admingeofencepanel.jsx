import React, { useMemo, useState } from 'react'
import { geofenceAPI } from '../services/api'

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

const emptyForm = { name: '', description: '', latitude: '', longitude: '', radius: 500, userId: '' }

export default function AdminGeofencePanel({ users, geofences, setGeofences, now: nowProp }) {
  const now = nowProp || Date.now()
  const [form, setForm]       = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  const usersById = useMemo(() => {
    const m = new Map()
    users.forEach((u) => m.set(u.id, u))
    return m
  }, [users])

  // Live inside/outside status for every (geofence, its assigned user) pair,
  // derived from the same live location data already flowing through the
  // dashboard's WebSocket — no extra network calls needed.
  const statusByGeofenceId = useMemo(() => {
    const map = new Map()
    geofences.forEach((gf) => {
      const owner = usersById.get(gf.user_id)
      const loc = owner?.last_location
      if (!gf.is_active || !owner || !loc?.latitude || !loc?.longitude) {
        map.set(gf.id, { state: 'unknown' })
        return
      }
      const ts = loc.timestamp ? new Date(loc.timestamp).getTime() : null
      const isLive = ts ? now - ts <= STALE_MS : false
      const distance = haversineMeters(Number(loc.latitude), Number(loc.longitude), Number(gf.latitude), Number(gf.longitude))
      map.set(gf.id, {
        state: distance <= Number(gf.radius) ? 'inside' : 'outside',
        isLive,
        distance,
      })
    })
    return map
  }, [geofences, usersById, now])

  const filteredGeofences = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return geofences
    return geofences.filter((gf) => {
      const owner = usersById.get(gf.user_id)
      return (
        gf.name.toLowerCase().includes(q) ||
        (owner?.username || '').toLowerCase().includes(q) ||
        (owner?.email || '').toLowerCase().includes(q)
      )
    })
  }, [geofences, search, usersById])

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setError('') }

  const startEdit = (gf) => {
    setEditingId(gf.id)
    setForm({
      name: gf.name || '',
      description: gf.description || '',
      latitude: gf.latitude,
      longitude: gf.longitude,
      radius: gf.radius,
      userId: gf.user_id,
    })
    setError('')
  }

  const refresh = async () => {
    const res = await geofenceAPI.getAllGeofences()
    setGeofences(res.data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || form.latitude === '' || form.longitude === '' || !form.userId) {
      setError('Name, latitude, longitude and assigned user are all required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await geofenceAPI.updateGeofence(editingId, {
          name: form.name,
          description: form.description,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          radius: parseFloat(form.radius),
        })
      } else {
        await geofenceAPI.createGeofence({
          name: form.name,
          description: form.description,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          radius: parseFloat(form.radius),
          user_id: form.userId,
        })
      }
      await refresh()
      resetForm()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save geofence')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (gf) => {
    try {
      await geofenceAPI.updateGeofence(gf.id, { is_active: !gf.is_active })
      setGeofences((prev) => prev.map((g) => (g.id === gf.id ? { ...g, is_active: !g.is_active } : g)))
    } catch {
      setError('Failed to update geofence status')
    }
  }

  const handleDelete = async (gf) => {
    if (!window.confirm(`Delete geofence "${gf.name}"?`)) return
    try {
      await geofenceAPI.deleteGeofence(gf.id)
      setGeofences((prev) => prev.filter((g) => g.id !== gf.id))
      if (editingId === gf.id) resetForm()
    } catch {
      setError('Failed to delete geofence')
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#fff', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600 }

  return (
    <div>
      {/* ── Create / Edit form ─────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
          {editingId ? 'Edit Geofence' : 'Create New Geofence'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
          {editingId
            ? "Assigned user cannot be changed here — delete and recreate to reassign."
            : "Choose which user this zone applies to. Only that user's location updates are checked against it."}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#fca5a5',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g., Warehouse, School Zone" />
            </div>
            <div>
              <label style={labelStyle}>Assign to user *</label>
              <select
                style={{ ...inputStyle, opacity: editingId ? 0.5 : 1 }}
                value={form.userId}
                disabled={!!editingId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              >
                <option value="">Select a user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Latitude *</label>
              <input style={inputStyle} type="number" step="0.0001" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="e.g., 51.5074" />
            </div>
            <div>
              <label style={labelStyle}>Longitude *</label>
              <input style={inputStyle} type="number" step="0.0001" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="e.g., -0.1278" />
            </div>
            <div>
              <label style={labelStyle}>Radius (meters)</label>
              <input style={inputStyle} type="number" min="50" max="10000" value={form.radius} onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} style={{
              padding: '12px 22px', borderRadius: 10,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
            }}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Geofence'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{
                padding: '12px 22px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>All Geofences</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or user…"
              style={{ ...inputStyle, width: 220, padding: '8px 12px' }}
            />
            <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: 20, color: 'rgba(255,255,255,0.5)' }}>
              {filteredGeofences.length} zones
            </div>
          </div>
        </div>

        {filteredGeofences.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🛰️</div>
            No geofences yet — create one above
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, padding: 20 }}>
            {filteredGeofences.map((gf) => {
              const owner = usersById.get(gf.user_id)
              const status = statusByGeofenceId.get(gf.id) || { state: 'unknown' }
              const statusColors = {
                inside:  { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  text: '#4ade80', label: '● Inside' },
                outside: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.5)', label: 'Outside' },
                unknown: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.3)', label: 'No signal' },
              }
              const sc = statusColors[status.state]

              return (
                <div key={gf.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${gf.is_active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  borderLeft: `4px solid ${gf.is_active ? '#6366f1' : '#4b5563'}`,
                  borderRadius: 12, padding: 16,
                  opacity: gf.is_active ? 1 : 0.6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{gf.name}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: gf.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                      color: gf.is_active ? '#22c55e' : '#9ca3af',
                      border: `1px solid ${gf.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      whiteSpace: 'nowrap',
                    }}>{gf.is_active ? 'Enabled' : 'Disabled'}</span>
                  </div>

                  {gf.description && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>{gf.description}</div>
                  )}

                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
                    {Number(gf.latitude).toFixed(4)}, {Number(gf.longitude).toFixed(4)} · {gf.radius}m radius
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0,
                      }}>{(owner?.username || '?').charAt(0).toUpperCase()}</div>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                        {owner?.username || gf.owner_username || 'Unknown user'}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                    }}>{sc.label}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => startEdit(gf)} style={{
                      flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc',
                    }}>Edit</button>
                    <button onClick={() => handleToggleActive(gf)} style={{
                      flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24',
                    }}>{gf.is_active ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => handleDelete(gf)} style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171',
                    }}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}