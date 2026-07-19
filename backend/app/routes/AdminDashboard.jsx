import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { authAPI } from '../services/api'
import { useAuthStore } from '../store'

// ── Car icons ────────────────────────────────────────────────────────────────
function makeRedCarIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(239,68,68,0.5);animation:rping 1.4s ease-out infinite;"></div>
        <div style="position:absolute;inset:10px;border-radius:50%;border:1.5px solid rgba(239,68,68,0.3);animation:rping 1.4s ease-out 0.5s infinite;"></div>
        <div style="font-size:32px;filter:drop-shadow(0 0 12px rgba(239,68,68,1));animation:bob 2s ease-in-out infinite;">🚗</div>
      </div>
      <style>
        @keyframes rping{0%{transform:scale(.8);opacity:.8}70%{transform:scale(2.2);opacity:0}100%{transform:scale(.8);opacity:.8}}
        @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      </style>`,
    iconSize: [56, 56], iconAnchor: [28, 28], popupAnchor: [0, -32],
  })
}

function makeGreyCarIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:26px;opacity:0.4;filter:grayscale(1);">🚗</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -18],
  })
}

// ── Pan helper ───────────────────────────────────────────────────────────────
function PanTo({ position }) {
  const map = useMap()
  useEffect(() => { if (position) map.panTo(position, { animate: true, duration: 0.8 }) }, [position, map])
  return null
}

// ── User Live Modal ──────────────────────────────────────────────────────────
function UserLiveModal({ user, onClose, liveLocation }) {
  const [tick, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id) }, [])

  const loc = liveLocation || user?.last_location
  if (!user) return null

  const ts = loc?.timestamp ? new Date(loc.timestamp).getTime() : null
  const secsAgo = ts ? Math.floor((Date.now() - ts) / 1000) : null
  const timeAgo = secsAgo == null ? '—'
    : secsAgo < 60   ? `${secsAgo}s ago`
    : secsAgo < 3600 ? `${Math.floor(secsAgo / 60)}m ago`
    : `${Math.floor(secsAgo / 3600)}h ago`
  const isLive = secsAgo != null && secsAgo < 60

  const center = loc ? [Number(loc.latitude), Number(loc.longitude)] : [20, 78]

  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,zIndex:9999,
      background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',maxWidth:740,background:'#0f0f14',
        border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,
        overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:12}}>
          <div style={{
            width:42,height:42,borderRadius:'50%',fontWeight:900,fontSize:17,
            display:'flex',alignItems:'center',justifyContent:'center',
            background:isLive?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.05)',
            border:`2px solid ${isLive?'#ef4444':'#333'}`,
            color:isLive?'#ef4444':'#555',
          }}>{(user.username||'?').charAt(0).toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:15,color:'#fff'}}>{user.username}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.35)'}}>{user.email}</div>
          </div>
          <span style={{
            fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:20,
            background:isLive?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.05)',
            color:isLive?'#ef4444':'#666',
            border:`1px solid ${isLive?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.08)'}`,
          }}>{isLive?'🔴 LIVE':'OFFLINE'}</span>
          <button onClick={onClose} style={{
            width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)',
            fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          }}>×</button>
        </div>

        {/* Map */}
        <div style={{height:400,position:'relative'}}>
          <style>{`
            .modal-map .leaflet-tile{filter:brightness(.75) invert(1) hue-rotate(180deg) saturate(.5) contrast(1.1)}
            .modal-map .leaflet-control-zoom a{background:rgba(20,20,28,.95)!important;color:#fff!important;border-color:rgba(255,255,255,.08)!important}
            .modal-map .leaflet-popup-content-wrapper{background:#1a1a24!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:12px!important}
            .modal-map .leaflet-popup-tip{background:#1a1a24!important}
            .modal-map .leaflet-control-attribution{background:rgba(0,0,0,.5)!important;color:rgba(255,255,255,.25)!important}
          `}</style>
          {loc ? (
            <MapContainer center={center} zoom={16} style={{width:'100%',height:'100%'}} className="modal-map">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors"/>
              <PanTo position={center}/>
              <Marker position={center} icon={isLive ? makeRedCarIcon() : makeGreyCarIcon()}>
                <Popup>
                  <div style={{color:'#fff',fontFamily:'-apple-system,sans-serif'}}>
                    <div style={{fontWeight:800,marginBottom:4}}>🚗 {user.username}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{timeAgo}</div>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.3)',gap:12}}>
              <div style={{fontSize:48}}>📡</div>
              <div>No location data yet</div>
            </div>
          )}
          {isLive && (
            <div style={{
              position:'absolute',top:12,right:12,zIndex:1000,
              background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.4)',
              borderRadius:20,padding:'5px 12px',display:'flex',alignItems:'center',gap:6,
              backdropFilter:'blur(8px)',
            }}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'#ef4444',boxShadow:'0 0 8px rgba(239,68,68,0.8)',animation:'rping 1.4s ease-out infinite'}}/>
              <span style={{fontSize:11,fontWeight:700,color:'#ef4444'}}>LIVE TRACKING</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{padding:'14px 20px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:12}}>
          {[
            ['Latitude',  loc ? Number(loc.latitude).toFixed(5)  : '—'],
            ['Longitude', loc ? Number(loc.longitude).toFixed(5) : '—'],
            ['Accuracy',  loc?.accuracy ? `${Number(loc.accuracy).toFixed(0)} m` : '—'],
            ['Last seen', timeAgo],
          ].map(([label,val]) => (
            <div key={label} style={{flex:1,textAlign:'center'}}>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
              <div style={{fontSize:13,fontWeight:700,color:label==='Last seen'&&isLive?'#ef4444':'#fff'}}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main AdminDashboard ──────────────────────────────────────────────────────
const STALE_MS = 900_000

function computeIsLive(ts, now) {
  if (!ts) return false
  const t = new Date(ts).getTime()
  return !Number.isNaN(t) && now - t <= STALE_MS
}

function makeWsUrl(token) {
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api')
    .replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  const api = base.endsWith('/api') ? base : base.replace(/\/$/, '') + '/api'
  return `${api}/ws/tracking?token=${encodeURIComponent(token || '')}&is_admin=true`
}

export default function AdminDashboard() {
  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [search,        setSearch]        = useState('')
  const [filter,        setFilter]        = useState('all')
  const [now,           setNow]           = useState(() => Date.now())
  const [viewUserId,    setViewUserId]     = useState(null)
  const [liveLocations, setLiveLocations] = useState({}) // userId → latest location from WS

  const currentUser = useAuthStore(s => s.user)
  const token       = useAuthStore(s => s.token)
  const wsRef       = useRef(null)

  // Ticker
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authAPI.listUsers()
      setUsers(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Poll every 30s
  useEffect(() => {
    const id = setInterval(fetchUsers, 30_000)
    return () => clearInterval(id)
  }, [fetchUsers])

  // WebSocket with auto-reconnect
  useEffect(() => {
    if (!token) return
    let ws, timer, dead = false

    function connect() {
      if (dead) return
      ws = new WebSocket(makeWsUrl(token))
      wsRef.current = ws

      ws.onopen  = () => console.log('[WS-admin] connected')
      ws.onclose = (e) => {
        if (!dead && e.code !== 4401 && e.code !== 4403)
          timer = setTimeout(connect, 3000)
      }
      ws.onerror = () => {}
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d?.type !== 'location_update') return
          const { user_id, location } = d
          if (!user_id || !location) return
          // Update liveLocations for modal
          setLiveLocations(prev => ({ ...prev, [user_id]: location }))
          // Update users table last_location
          setUsers(prev => prev.map(u => u.id !== user_id ? u : { ...u, last_location: location }))
          setNow(Date.now())
        } catch { }
      }
    }

    connect()
    return () => { dead = true; clearTimeout(timer); try { ws?.close() } catch { } }
  }, [token])

  // Delete user
  const handleDelete = async (userId, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this user?')) return
    try {
      await authAPI.deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      if (viewUserId === userId) setViewUserId(null)
    } catch (e) { alert(e.response?.data?.detail || 'Failed') }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      const matchQ = !q ||
        (u.username||'').toLowerCase().includes(q) ||
        (u.email||'').toLowerCase().includes(q) ||
        (u.full_name||'').toLowerCase().includes(q)
      const matchF = filter === 'all' ||
        (filter === 'enabled'  &&  u.is_consent_given) ||
        (filter === 'disabled' && !u.is_consent_given)
      return matchQ && matchF
    })
  }, [users, search, filter])

  const activeCount   = useMemo(() => users.filter(u => computeIsLive(u.last_location?.timestamp, now)).length, [users, now])
  const consentCount  = useMemo(() => users.filter(u => u.is_consent_given).length, [users])
  const locationCount = useMemo(() => users.filter(u => u.last_location).length, [users])

  const viewUser = viewUserId ? users.find(u => u.id === viewUserId) : null
  const viewLoc  = viewUserId ? (liveLocations[viewUserId] || viewUser?.last_location) : null

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',color:'#fff',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <div style={{maxWidth:1400,margin:'0 auto',padding:'24px 20px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28}}>
          <div>
            <h1 style={{fontSize:24,fontWeight:900,margin:0,letterSpacing:'-0.5px'}}>👥 User Administration</h1>
            <p style={{margin:'4px 0 0',color:'rgba(255,255,255,0.4)',fontSize:13}}>Manage users and monitor live activity</p>
          </div>
          <button onClick={fetchUsers} disabled={loading} style={{
            padding:'10px 20px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',
            background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,fontWeight:700,
            cursor:'pointer',display:'flex',alignItems:'center',gap:6,
          }}>🔄 {loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[
            ['📊','Total Users',    users.length,    '#6366f1'],
            ['🟢','Active Now',     activeCount,     '#22c55e'],
            ['✅','Tracking On',    consentCount,    '#f59e0b'],
            ['📍','Has Location',   locationCount,   '#ef4444'],
          ].map(([icon,label,val,color]) => (
            <div key={label} style={{
              background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:14,padding:'16px 20px',display:'flex',alignItems:'center',gap:14,
            }}>
              <div style={{fontSize:28}}>{icon}</div>
              <div>
                <div style={{fontSize:26,fontWeight:900,color,lineHeight:1}}>{val}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:3,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <span>⚠️</span><span style={{flex:1,fontSize:13}}>{error}</span>
            <button onClick={() => setError('')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:18}}>×</button>
          </div>
        )}

        {/* Filters */}
        <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:240,position:'relative'}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:16}}>🔍</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by username, email, or name…"
              style={{
                width:'100%',padding:'10px 12px 10px 36px',
                background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:10,color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',
              }}
            />
          </div>
          <div style={{display:'flex',gap:6}}>
            {[['all','All Users'],['enabled','Tracking On'],['disabled','Tracking Off']].map(([val,label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                padding:'10px 16px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',
                background: filter===val ? '#fff' : 'rgba(255,255,255,0.05)',
                color:      filter===val ? '#000' : 'rgba(255,255,255,0.6)',
                border:     filter===val ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:800}}>User Management</h2>
            <span style={{fontSize:12,background:'rgba(255,255,255,0.07)',padding:'3px 10px',borderRadius:20,color:'rgba(255,255,255,0.5)'}}>{filtered.length} results</span>
          </div>

          {loading && users.length === 0 ? (
            <div style={{padding:48,textAlign:'center',color:'rgba(255,255,255,0.3)'}}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{padding:48,textAlign:'center',color:'rgba(255,255,255,0.3)'}}>No users found</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  {['User Info','Tracking','Status','Last Seen','Track','Actions'].map(h => (
                    <th key={h} style={{padding:'12px 20px',textAlign:'left',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const live = computeIsLive(u.last_location?.timestamp, now)
                  const isSelected = viewUserId === u.id
                  return (
                    <tr key={u.id} style={{
                      borderBottom: i < filtered.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: isSelected ? 'rgba(239,68,68,0.06)' : 'transparent',
                      transition:'background 0.15s',
                    }}>
                      {/* User info */}
                      <td style={{padding:'14px 20px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{
                            width:36,height:36,borderRadius:'50%',fontWeight:900,fontSize:14,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.7)',flexShrink:0,
                          }}>{(u.username||'?').charAt(0).toUpperCase()}</div>
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:'#fff',display:'flex',alignItems:'center',gap:6}}>
                              {u.username}
                              {u.id === currentUser?.id && <span style={{fontSize:10,background:'rgba(99,102,241,0.2)',color:'#818cf8',padding:'1px 6px',borderRadius:10}}>You</span>}
                              {u.is_admin && <span style={{fontSize:10,background:'rgba(245,158,11,0.2)',color:'#fbbf24',padding:'1px 6px',borderRadius:10}}>Admin</span>}
                            </div>
                            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Tracking */}
                      <td style={{padding:'14px 20px'}}>
                        <span style={{
                          fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20,
                          background: u.is_consent_given ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                          color:      u.is_consent_given ? '#22c55e' : '#666',
                          border:     `1px solid ${u.is_consent_given ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        }}>{u.is_consent_given ? '✓ Enabled' : '✗ Disabled'}</span>
                      </td>

                      {/* Status */}
                      <td style={{padding:'14px 20px'}}>
                        <span style={{
                          fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20,
                          background: u.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                          color:      u.is_active ? '#22c55e' : '#666',
                          border:     `1px solid ${u.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)'}`,
                        }}>{u.is_active ? 'Active' : 'Inactive'}</span>
                      </td>

                      {/* Last seen */}
                      <td style={{padding:'14px 20px',fontSize:12,color:'rgba(255,255,255,0.5)'}}>
                        {u.last_location ? new Date(u.last_location.timestamp).toLocaleString() : '—'}
                      </td>

                      {/* 👁 Eye button */}
                      <td style={{padding:'14px 20px'}}>
                        <button
                          onClick={e => { e.stopPropagation(); setViewUserId(isSelected ? null : u.id) }}
                          title={u.last_location ? 'View live location' : 'No location data'}
                          style={{
                            width:36,height:36,borderRadius:8,cursor: u.last_location ? 'pointer' : 'not-allowed',
                            background: isSelected ? 'rgba(239,68,68,0.2)' : u.last_location ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                            border:`1px solid ${isSelected ? 'rgba(239,68,68,0.6)' : u.last_location ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
                            fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',
                            transition:'all 0.15s',
                          }}
                        >👁</button>
                      </td>

                      {/* Delete */}
                      <td style={{padding:'14px 20px'}}>
                        <button
                          onClick={e => handleDelete(u.id, e)}
                          disabled={u.id === currentUser?.id}
                          title="Delete user"
                          style={{
                            width:36,height:36,borderRadius:8,
                            background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
                            cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer',
                            opacity: u.id === currentUser?.id ? 0.3 : 1,
                            fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',
                          }}
                        >🗑️</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Live Modal */}
      {viewUserId && viewUser && (
        <UserLiveModal
          user={viewUser}
          liveLocation={viewLoc}
          onClose={() => setViewUserId(null)}
        />
      )}
    </div>
  )
}