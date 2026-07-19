import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { authAPI, analyticsAPI, notificationAPI, sosAPI, geofenceAPI } from '../services/api'
import { useAuthStore } from '../store'
import AdminMap from './GoogleAdminMap'
import UserLiveModal from './UserLiveModal'
import RouteHistory from './RouteHistory'
import AdminGeofencePanel from './AdminGeofencePanel'
import GeofenceAnalyticsPanel from './GeofenceAnalyticsPanel'
import WeatherWidget from './WeatherWidget'

const STALE_MS = 300_000

function makeWsUrl(token) {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const wsBase  = apiBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  const base    = wsBase.endsWith('/api') ? wsBase : wsBase.replace(/\/$/, '') + '/api'
  return `${base}/ws/tracking?token=${encodeURIComponent(token || '')}&is_admin=true`
}
function computeIsLive(ts, now) {
    if (!ts) return false;

    const time = new Date(ts).getTime();

    if (isNaN(time)) return false;

    return (now - time) < 300000;
}

function timeAgo(ts) {
    if (!ts) return "Never";

    const diff = Date.now() - new Date(ts).getTime();

    if (diff < 10000) return "Just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)} sec ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;

    return `${Math.floor(diff / 86400000)} day ago`;
}
// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color, pulse }) {
  return (
    <div className="admin-stat-card" style={{
      background:'rgba(255,255,255,0.03)',
      border:`1px solid ${color}22`,
      borderRadius:16,
      padding:'20px 24px',
      display:'flex', alignItems:'center', gap:16,
      position:'relative', overflow:'hidden',
      transition:'transform 0.2s, box-shadow 0.2s',
      cursor:'default',
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 32px ${color}22`}}
    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
    >
      <div style={{
        width:52, height:52, borderRadius:14,
        background:`${color}15`,
        border:`1px solid ${color}30`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:24, flexShrink:0, position:'relative',
      }}>
        {icon}
        {pulse && (
          <div style={{
            position:'absolute', top:6, right:6,
            width:8, height:8, borderRadius:'50%',
            background:'#22c55e',
            boxShadow:'0 0 8px #22c55e',
            animation:'admin-pulse 1.5s ease-in-out infinite',
          }}/>
        )}
      </div>
      <div>
        <div style={{fontSize:28,fontWeight:900,color:'#fff',lineHeight:1}}>{value}</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:4,fontWeight:500}}>{label}</div>
      </div>
      <div style={{
        position:'absolute', right:-20, top:-20,
        width:80, height:80, borderRadius:'50%',
        background:`${color}08`,
      }}/>
    </div>
  )
}

// ── User Row ──────────────────────────────────────────────────────────────────
function UserRow({ u, now, currentUser, isSelected, onSelect, onView, onDelete }) {
  const live = computeIsLive(u.last_location?.timestamp, now)
  return (
    <tr onClick={() => onSelect(u.id)} style={{
      borderBottom:'1px solid rgba(255,255,255,0.04)',
      background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
      cursor:'pointer', transition:'background 0.15s',
    }}
    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='rgba(255,255,255,0.03)' }}
    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='transparent' }}
    >
      {/* User info */}
      <td style={{padding:'14px 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{
            width:40,height:40,borderRadius:'50%',flexShrink:0,
            background:`linear-gradient(135deg,${live?'#6366f1':'#374151'},${live?'#8b5cf6':'#4b5563'})`,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:16,fontWeight:800,color:'#fff',
            boxShadow: live ? '0 0 12px rgba(99,102,241,0.4)' : 'none',
            position:'relative',
          }}>
            {(u.username||'?').charAt(0).toUpperCase()}
            {live && (
              <div style={{
                position:'absolute',bottom:0,right:0,
                width:12,height:12,borderRadius:'50%',
                background:'#22c55e',border:'2px solid #0a0a14',
              }}/>
            )}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'#fff',display:'flex',alignItems:'center',gap:6}}>
              {u.username}
              {u.id === currentUser?.id && (
                <span style={{fontSize:10,background:'rgba(99,102,241,0.2)',color:'#a5b4fc',padding:'1px 6px',borderRadius:20,fontWeight:600}}>You</span>
              )}
              {u.is_admin && (
                <span style={{fontSize:10,background:'rgba(245,158,11,0.2)',color:'#fbbf24',padding:'1px 6px',borderRadius:20,fontWeight:600}}>Admin</span>
              )}
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:2}}>{u.email}</div>
          </div>
        </div>
      </td>

      {/* Tracking */}
      <td style={{padding:'14px 16px'}}>
        <span style={{
          fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20,
          background: u.is_consent_given ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
          color:      u.is_consent_given ? '#22c55e' : '#6b7280',
          border:     `1px solid ${u.is_consent_given ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
        }}>{u.is_consent_given ? '✓ On' : '✗ Off'}</span>
      </td>

      {/* Status */}
      <td style={{padding:'14px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{
            width:7,height:7,borderRadius:'50%',
            background: live ? '#22c55e' : '#6b7280',
            boxShadow: live ? '0 0 6px #22c55e' : 'none',
            animation: live ? 'admin-pulse 2s infinite' : 'none',
          }}/>
          <span style={{fontSize:12,color: live?'#22c55e':'rgba(255,255,255,0.4)',fontWeight:600}}>
            {live ? 'Live' : 'Offline'}
          </span>
        </div>
      </td>

      {/* Last seen */}
      <td style={{padding:'14px 16px',fontSize:12,color:'rgba(255,255,255,0.45)'}}>
        {u.last_location ? (
          <div>
            <div style={{color:'rgba(255,255,255,0.7)',fontWeight:500}}>{timeAgo(u.last_location.timestamp)}</div>
            <div style={{fontSize:10,marginTop:2}}>{new Date(u.last_location.timestamp).toLocaleString()}</div>
          </div>
        ) : '—'}
      </td>

      {/* Eye button */}
      <td style={{padding:'14px 16px'}}>
        <button
          onClick={e => { e.stopPropagation(); onView(u.id) }}
          style={{
            width:34,height:34,borderRadius:8,cursor:'pointer',
            background: u.last_location ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
            border:`1px solid ${u.last_location ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
            color: u.last_location ? '#ef4444' : '#374151',
            fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',
            transition:'all 0.15s',
          }}
          onMouseEnter={e=>{if(u.last_location){e.currentTarget.style.background='rgba(239,68,68,0.2)'}}}
          onMouseLeave={e=>{if(u.last_location){e.currentTarget.style.background='rgba(239,68,68,0.1)'}}}
          title={u.last_location ? 'View live location' : 'No location data'}
        >👁</button>
      </td>

      {/* Delete */}
      <td style={{padding:'14px 16px'}}>
        <button
          onClick={e => { e.stopPropagation(); onDelete(u.id) }}
          disabled={u.id === currentUser?.id}
          style={{
            width:34,height:34,borderRadius:8,
            background:'rgba(239,68,68,0.06)',
            border:'1px solid rgba(239,68,68,0.15)',
            color:'#ef4444',fontSize:15,
            cursor: u.id===currentUser?.id ? 'not-allowed' : 'pointer',
            opacity: u.id===currentUser?.id ? 0.3 : 1,
            display:'flex',alignItems:'center',justifyContent:'center',
            transition:'all 0.15s',
          }}
          onMouseEnter={e=>{if(u.id!==currentUser?.id)e.currentTarget.style.background='rgba(239,68,68,0.15)'}}
          onMouseLeave={e=>{if(u.id!==currentUser?.id)e.currentTarget.style.background='rgba(239,68,68,0.06)'}}
          title="Delete user"
        >🗑️</button>
      </td>
    </tr>
  )
}

// ── Tab error boundary ────────────────────────────────────────────────────────
// Without this, an uncaught render error in ANY tab (e.g. rendering a
// non-string value where React expects text) unmounts the entire
// AdminDashboard tree — which also tears down the WebSocket connection,
// showing as a spurious "DISCONNECTED" in the console. This contains the
// blast radius to just the active tab.
class TabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error, info) {
    console.error('[AdminDashboard] tab crashed:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:48,textAlign:'center',color:'rgba(255,255,255,0.5)'}}>
          <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
          <div style={{fontWeight:700,marginBottom:6,color:'#fff'}}>This tab hit an error</div>
          <div style={{fontSize:13}}>Try switching tabs, or refresh the page. Check the browser console for details.</div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard({ focusUsername = '' }) {
  const [users,         setUsers]         = useState([])
  const liveLocRef = React.useRef({})
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [wsStatus,      setWsStatus]      = useState('connecting')
  const [selectedUserId,setSelectedUserId]= useState(null)
  const [searchTerm,    setSearchTerm]    = useState('')
  const [filterConsent, setFilterConsent] = useState('all')
  const [now,           setNow]           = useState(() => Date.now())
  const [viewUserId,    setViewUserId]    = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notifOpen,     setNotifOpen]     = useState(false)
  const [emergencyAlert,setEmergencyAlert]= useState(null)
  const [sosAlerts,     setSosAlerts]     = useState([])
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [adminOverview,  setAdminOverview] = useState(null)
  const [overviewError,  setOverviewError] = useState('')
  const [activeTab,      setActiveTab]     = useState('overview')
  const [geofences,      setGeofences]     = useState([])
  const [geofencesError, setGeofencesError] = useState('')
  const [voiceEnabled,   setVoiceEnabled]  = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('tai_voice_alerts') !== 'off'
  })
  const voiceEnabledRef = useRef(voiceEnabled)
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
    try { window.localStorage.setItem('tai_voice_alerts', voiceEnabled ? 'on' : 'off') } catch {}
  }, [voiceEnabled])

  const currentUser = useAuthStore(s => s.user)
  const token       = useAuthStore(s => s.token)
  const wsRef       = useRef(null)
  const selectedUser = useMemo(
    () => users.find(u => u.id === selectedUserId) || null,
    [users, selectedUserId],
  )

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const addNotification = useCallback((n) => {
    if (!n?.id) return
    setNotifications(prev => prev.some(x => x.id===n.id) ? prev : [n,...prev].slice(0,80))
  }, [])

  // ── AI Voice Alerts (browser text-to-speech) ────────────────────────────
  const speak = useCallback((text) => {
    if (!voiceEnabledRef.current) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    try {
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1
      utter.pitch = 1
      utter.volume = 1
      window.speechSynthesis.speak(utter)
    } catch {}
  }, [])

  const announceNotification = useCallback((n) => {
    if (!n) return
    const type = n.type || ''
    let meta = {}
    try { meta = n.metadata_json ? JSON.parse(n.metadata_json) : {} } catch {}
    const zoneName = meta.geofence_name || ''
    const restricted = /restrict/i.test(zoneName) || /restrict/i.test(n.title || '')
    // The WS payload nests a `user` object (see serialize_notification in
    // notifications.py) — prefer that; n.message already has the real name
    // baked in too (create_notification formats it server-side), so that's
    // the fallback rather than a generic "User".
    const who = n.user?.username || n.user?.full_name

    let text = ''
    if (type === 'sos_activated') {
      text = 'S O S detected.' + (n.message ? ` ${n.message}` : '')
    } else if (type.startsWith('geofence_enter')) {
      text = restricted
        ? `Warning. ${who ? `${who} entered` : 'User entered'} a restricted area${zoneName ? `, ${zoneName}` : ''}.`
        : (n.message || `User entered the geofence${zoneName ? `, ${zoneName}` : ''}.`)
    } else if (type.startsWith('geofence_exit')) {
      text = restricted
        ? `${who ? `${who} exited` : 'User exited'} the restricted area${zoneName ? `, ${zoneName}` : ''}.`
        : (n.message || `User exited the geofence${zoneName ? `, ${zoneName}` : ''}.`)
    }
    if (text) speak(text)
  }, [speak])

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 5_000); return () => clearInterval(id) }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await authAPI.listUsers()
      setUsers(prev => res.data.map(u => {
        const liveData = liveLocRef.current[u.id]
        if (liveData) return { ...u, last_location: liveData }
        // Keep existing live data from state if DB data is older
        const existing = prev.find(p => p.id === u.id)
        if (existing?.last_location && u.last_location) {
          const existingTs = new Date(existing.last_location.timestamp).getTime()
          const newTs = new Date(u.last_location.timestamp).getTime()
          if (existingTs > newTs) return { ...u, last_location: existing.last_location }
        }
        return u
      }))
    }
    catch (e) { setError(e.response?.data?.detail || 'Failed to fetch users') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { const id = setInterval(fetchUsers, 15_000); return () => clearInterval(id) }, [fetchUsers])

  const fetchGeofences = useCallback(async () => {
    try {
      const res = await geofenceAPI.getAllGeofences()
      setGeofences(res.data || [])
      setGeofencesError('')
    } catch (e) {
      setGeofencesError(e.response?.data?.detail || 'Failed to load geofences')
    }
  }, [])

  useEffect(() => { fetchGeofences() }, [fetchGeofences])
  useEffect(() => { const id = setInterval(fetchGeofences, 30_000); return () => clearInterval(id) }, [fetchGeofences])

  useEffect(() => {
    let cancelled = false
    analyticsAPI.getAdminOverview(7)
      .then((res) => { if (!cancelled) setAdminOverview(res.data) })
      .catch((err) => { if (!cancelled) setOverviewError(err.response?.data?.detail || 'Failed to load AI overview') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const q = (focusUsername || '').trim().toLowerCase()
    if (!q || users.length === 0) return
    const match = users.find((u) => (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    if (match) {
      setSelectedUserId(match.id)
      setViewUserId(match.id)
      setSearchTerm(match.username || q)
    }
  }, [focusUsername, users])

  useEffect(() => {
    notificationAPI.list(80).then(r => setNotifications(r.data||[])).catch(()=>{})
    sosAPI.list(20).then(r => setSosAlerts(r.data||[])).catch(()=>{})
  }, [])

  useEffect(() => {
    if (!token) return
    let ws, timer, dead = false
    function connect() {
      if (dead) return
      const wsUrl = makeWsUrl(token)
      console.log('%c[WS-ADMIN] 🔄 Connecting to:' + wsUrl, 'color:cyan;font-size:14px')
      ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.onopen  = () => {
        setWsStatus('live')
        console.log('%c[WS-ADMIN] ✅ CONNECTED', 'color:lime;font-size:16px;font-weight:bold')
      }
      ws.onclose = e => {
        setWsStatus('disconnected')
        console.log('%c[WS-ADMIN] ❌ DISCONNECTED code:' + e.code, 'color:red;font-size:16px;font-weight:bold')
        if (!dead && e.code!==4401 && e.code!==4403) timer = setTimeout(connect, 3000)
      }
      ws.onerror = (err) => {
        setWsStatus('error')
        console.log('%c[WS-ADMIN] ⚠️ ERROR', 'color:orange;font-size:16px;font-weight:bold', err)
      }
      ws.onmessage = e => {
        try {
          const d = JSON.parse(e.data)
          if (d?.type==='ping') return
          if (d?.type==='notification') { addNotification(d.notification); announceNotification(d.notification); return }
          if (d?.type==='sos_alert') {
            addNotification(d.notification)
            announceNotification(d.notification)
            setEmergencyAlert(d.sos)
            setSosAlerts(p => [d.sos,...p.filter(s=>s.id!==d.sos?.id)].slice(0,20))
            return
          }
          if (d?.type === "location_update") {
    const { user_id, location } = d;

    if (!user_id || !location) return;

    liveLocRef.current[user_id] = {
        ...location,
        timestamp: location.timestamp || new Date().toISOString(),
    };
setUsers(prev => {
  console.log("WS user_id:", user_id);

  prev.forEach(u => {
    console.log("User ID:", u.id, "Username:", u.username);
  });

  return prev.map(u => {
    if (String(u.id) === String(user_id)) {
      console.log("✅ MATCH FOUND:", u.username);

      return {
        ...u,
        last_location: {
          ...location,
          timestamp: new Date().toISOString(),
        },
        is_active: true,
      };
    }

    return u;
  });
});

    setNow(Date.now());

    console.log("✅ LIVE UPDATE:", user_id, location);
}
        } catch { }
      }
    }
    connect()
    return () => { dead=true; clearTimeout(timer); try{ws?.close()}catch{} }
  }, [token, addNotification, announceNotification])

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) return
    try { await authAPI.deleteUser(userId); setUsers(p=>p.filter(u=>u.id!==userId)); if(selectedUserId===userId) setSelectedUserId(null) }
    catch(e) { alert(e.response?.data?.detail||'Failed') }
  }

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return users.filter(u => {
      const matchQ = !q || (u.username||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.full_name||'').toLowerCase().includes(q)
      const matchF = filterConsent==='all' || (filterConsent==='enabled'&&u.is_consent_given) || (filterConsent==='disabled'&&!u.is_consent_given)
      return matchQ && matchF
    })
  }, [users, searchTerm, filterConsent])

  const activeUsers  = useMemo(() => users.filter(u=>computeIsLive(u.last_location?.timestamp,now)).length,[users,now])
  const consentUsers = useMemo(() => users.filter(u=>u.is_consent_given).length,[users])
  const locUsers     = useMemo(() => users.filter(u=>u.last_location).length,[users])

  const handleMarkRead = async (n) => {
    if (!n?.id) return
    setNotifications(p=>p.map(x=>x.id===n.id?{...x,is_read:true}:x))
    try { await notificationAPI.markRead(n.id) } catch {}
  }
  const handleMarkAllRead = async () => {
    setNotifications(p=>p.map(n=>({...n,is_read:true})))
    try { await notificationAPI.markAllRead() } catch {}
  }

  const wsColors = { live:'#22c55e', connecting:'#f59e0b', disconnected:'#ef4444', error:'#ef4444' }
  const wsLabels = { live:'Live', connecting:'Connecting…', disconnected:'Reconnecting…', error:'Error' }

  return (
    <div style={{
      minHeight:'100vh', background:'#0a0a14',
      color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      <style>{`
        @keyframes admin-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.2)}}
        @keyframes admin-slide-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes admin-sos{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.7)}70%{box-shadow:0 0 0 20px rgba(239,68,68,0)}}
        .admin-tr:hover td{background:rgba(255,255,255,0.02)}
        .admin-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .admin-route-replay .rh-root{height:680px;min-height:0}
        @media(min-width:769px) and (max-width:1100px){
          .admin-main-layout{grid-template-columns:minmax(0,1fr) 320px!important;gap:14px!important}
          .admin-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        }
        @media(max-width:768px){
          .admin-page-content{padding:16px!important}
          .admin-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
          .admin-filters{flex-direction:column!important}
          .admin-header-row{height:auto!important;min-height:64px;padding:10px 0;gap:10px!important;flex-wrap:wrap}
          .admin-main-layout{grid-template-columns:minmax(0,1fr)!important}
          .admin-sidebar-panel{position:relative!important;top:auto!important;width:100%}
          .admin-route-replay .rh-root{height:auto;min-height:680px}
          .admin-route-replay .rh-sidebar{width:300px;min-width:260px}
        }
        @media(max-width:480px){
          .admin-page-content{padding:12px!important}
          .admin-stats-grid{grid-template-columns:1fr!important}
          .admin-header-actions{width:100%;justify-content:flex-end}
          .admin-notification-panel{position:fixed!important;top:68px!important;left:10px!important;right:10px!important;width:auto!important;max-height:70vh!important}
          .admin-stat-card{padding:16px!important}
          .admin-filter-buttons{display:grid!important;grid-template-columns:repeat(3,1fr);width:100%}
          .admin-filter-buttons button{padding:9px 5px!important}
          .admin-route-replay{padding:12px!important}
          .admin-route-replay .rh-root{flex-direction:column;height:auto;min-height:0}
          .admin-route-replay .rh-sidebar{width:100%;max-width:none;min-width:0;border-right:0}
          .admin-route-replay .rh-map-wrap{height:420px;min-height:420px;flex:none}
          .admin-route-replay .maplibre-container{min-height:420px!important}
          .admin-sidebar-panel .maplibre-container{min-height:380px!important}
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background:'rgba(255,255,255,0.02)',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        padding:'0 24px',
        position:'sticky',top:0,zIndex:100,
        backdropFilter:'blur(20px)',
      }}>
        <div style={{maxWidth:1400,margin:'0 auto',height:64,display:'flex',alignItems:'center',justifyContent:'space-between'}} className="admin-header-row">
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{
              width:40,height:40,borderRadius:12,
              background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,
              boxShadow:'0 4px 16px rgba(99,102,241,0.4)',
            }}>🛡️</div>
            <div>
              <div style={{fontWeight:800,fontSize:16,letterSpacing:'-0.3px'}}>Admin Dashboard</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',display:'flex',alignItems:'center',gap:5,marginTop:1}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:wsColors[wsStatus]||'#6b7280',animation:'admin-pulse 2s infinite'}}/>
                {wsLabels[wsStatus]||'—'} · TrackAI Control Panel
              </div>
            </div>
          </div>

          <div className="admin-header-actions" style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Voice alerts toggle */}
            <button
              onClick={()=>{
                const next = !voiceEnabled
                voiceEnabledRef.current = next   // update synchronously — the effect below hasn't run yet at this point
                setVoiceEnabled(next)
                if (next) speak('Voice alerts enabled')
              }}
              title={voiceEnabled ? 'Voice alerts on — click to mute' : 'Voice alerts muted — click to enable'}
              style={{
                width:40,height:40,borderRadius:10,
                background: voiceEnabled ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.05)',
                border:`1px solid ${voiceEnabled ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color:'#fff',fontSize:16,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',
                transition:'all 0.15s',
              }}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>

            {/* Notification bell */}
            <div style={{position:'relative'}}>
              <button onClick={()=>setNotifOpen(o=>!o)} style={{
                width:40,height:40,borderRadius:10,
                background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(255,255,255,0.1)',
                color:'#fff',fontSize:17,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',
                position:'relative',transition:'all 0.15s',
              }}>
                🔔
                {unreadCount>0 && (
                  <div style={{
                    position:'absolute',top:-4,right:-4,
                    minWidth:18,height:18,borderRadius:20,
                    background:'#ef4444',border:'2px solid #0a0a14',
                    fontSize:10,fontWeight:800,color:'#fff',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    padding:'0 4px',
                  }}>{unreadCount>99?'99+':unreadCount}</div>
                )}
              </button>

              {notifOpen && (
                <div className="admin-notification-panel" style={{
                  position:'absolute',top:48,right:0,
                  width:340,maxHeight:420,
                  background:'#12121f',border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:16,boxShadow:'0 16px 48px rgba(0,0,0,0.7)',
                  overflow:'hidden',zIndex:200,animation:'admin-slide-in 0.2s ease-out',
                }}>
                  <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontWeight:700,fontSize:14}}>Notifications <span style={{color:'rgba(255,255,255,0.35)',fontSize:12,fontWeight:400}}>({unreadCount} unread)</span></div>
                    {unreadCount>0 && <button onClick={handleMarkAllRead} style={{fontSize:11,color:'#6366f1',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Mark all read</button>}
                  </div>
                  <div style={{maxHeight:340,overflowY:'auto'}}>
                    {notifications.length===0 ? (
                      <div style={{padding:32,textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:13}}>No notifications yet</div>
                    ) : notifications.map(n => (
                      <button key={n.id} onClick={()=>handleMarkRead(n)} style={{
                        width:'100%',padding:'12px 16px',
                        background: n.is_read?'transparent':n.type==='sos_activated'?'rgba(239,68,68,0.08)':'rgba(99,102,241,0.06)',
                        border:'none',borderBottom:'1px solid rgba(255,255,255,0.04)',
                        cursor:'pointer',textAlign:'left',display:'flex',gap:10,alignItems:'flex-start',
                      }}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:n.is_read?'transparent':n.type==='sos_activated'?'#ef4444':'#6366f1',marginTop:4,flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:12,color:'#fff'}}>{n.title}</div>
                          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>{n.message}</div>
                          <div style={{fontSize:10,color:'rgba(255,255,255,0.25)',marginTop:4}}>{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Refresh */}
            <button onClick={fetchUsers} disabled={loading} style={{
              padding:'0 16px',height:40,borderRadius:10,
              background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border:'none',color:'#fff',fontSize:13,fontWeight:700,
              cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,
              display:'flex',alignItems:'center',gap:6,transition:'all 0.15s',
              boxShadow:'0 2px 12px rgba(99,102,241,0.3)',
            }}>
              <span style={{animation:loading?'admin-pulse 1s infinite':'none'}}>🔄</span>
              {loading?'Refreshing…':'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-page-content" style={{maxWidth:1400,margin:'0 auto',padding:'24px 24px'}}>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div style={{display:'flex',gap:8,marginBottom:24}}>
          {[['overview','Overview'],['geofences','Geofences'],['analytics','Analytics']].map(([val,label])=>(
            <button key={val} onClick={()=>setActiveTab(val)} style={{
              padding:'10px 20px',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',
              background: activeTab===val ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.04)',
              color:      activeTab===val ? '#fff' : 'rgba(255,255,255,0.5)',
              border:     activeTab===val ? 'none' : '1px solid rgba(255,255,255,0.08)',
              boxShadow:  activeTab===val ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
              transition:'all 0.15s',
              display:'flex',alignItems:'center',gap:8,
            }}>
              {label}
              {val==='geofences' && geofences.length>0 && (
                <span style={{
                  fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:20,
                  background: activeTab===val ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                }}>{geofences.length}</span>
              )}
            </button>
          ))}
        </div>

        <TabErrorBoundary key={activeTab}>
        {activeTab === 'geofences' ? (
          <div>
            {geofencesError && (
              <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                <span>⚠️</span><span style={{flex:1,fontSize:13}}>{geofencesError}</span>
                <button onClick={()=>setGeofencesError('')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:18}}>×</button>
              </div>
            )}
            <AdminGeofencePanel
              users={users}
              geofences={geofences}
              setGeofences={setGeofences}
              now={now}
            />
          </div>
        ) : activeTab === 'analytics' ? (
          <GeofenceAnalyticsPanel
            users={users}
            geofences={geofences}
            activeUsersCount={activeUsers}
            liveNotifications={notifications}
          />
        ) : (
        <>

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <div className="admin-stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
          <StatCard icon="👥" value={users.length}  label="Total Users"       color="#6366f1" />
          <StatCard icon="📡" value={activeUsers}   label="Live Now"          color="#22c55e" pulse={activeUsers>0} />
          <StatCard icon="✅" value={consentUsers}  label="Tracking Enabled"  color="#f59e0b" />
          <StatCard icon="📍" value={locUsers}      label="Has Location"      color="#ef4444" />
        </div>

        {/* ── Error banners ───────────────────────────────────────────────────── */}
        {error && (
          <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10,animation:'admin-slide-in 0.2s'}}>
            <span>⚠️</span><span style={{flex:1,fontSize:13}}>{error}</span>
            <button onClick={()=>setError('')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:18}}>×</button>
          </div>
        )}

        {overviewError && (
          <div style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10,animation:'admin-slide-in 0.2s'}}>
            <span>ℹ️</span><span style={{flex:1,fontSize:13}}>{overviewError}</span>
            <button onClick={()=>setOverviewError('')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:18}}>×</button>
          </div>
        )}

        {adminOverview?.cards && (
          <div style={{marginBottom:24}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}} className="admin-stats-grid">
              <StatCard icon="📡" value={adminOverview.cards.total_live_users} label="Total Live Users" color="#22c55e" pulse={adminOverview.cards.total_live_users > 0} />
              <StatCard icon="🚨" value={adminOverview.cards.todays_alerts} label="Today's Alerts" color="#ef4444" />
              <StatCard icon="🚗" value={`${adminOverview.cards.distance_travelled_km} km`} label="Distance Travelled" color="#6366f1" />
              <StatCard icon="⏱" value={`${adminOverview.cards.average_trip_time_min} min`} label="Average Trip Time" color="#f59e0b" />
              <StatCard icon="🔋" value={`${adminOverview.cards.device_status?.live || 0}/${adminOverview.cards.device_status?.live + adminOverview.cards.device_status?.offline || 0}`} label="Device Status" color="#8b5cf6" />
              <StatCard icon="🗺" value={adminOverview.cards.most_visited_locations?.length || 0} label="Most Visited Locations" color="#14b8a6" />
            </div>

            <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}} className="admin-stats-grid">
              {(adminOverview.insights || []).slice(0, 4).map((insight) => (
                <div key={insight.type} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:'16px 18px'}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{insight.type.replace(/_/g, ' ')}</div>
                  <div style={{fontSize:14,fontWeight:700,marginTop:8,color:'#fff'}}>{insight.description}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.45)',marginTop:6}}>{insight.recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main layout ─────────────────────────────────────────────────────── */}
        <div className="admin-main-layout" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 380px',gap:20,alignItems:'start'}}>

          {/* ── Left: Table ─────────────────────────────────────────────────── */}
          <div>
            {/* Filters */}
            <div className="admin-filters" style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:220,position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:15,pointerEvents:'none'}}>🔍</span>
                <input
                  value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
                  placeholder="Search users…"
                  style={{
                    width:'100%',padding:'10px 12px 10px 36px',
                    background:'rgba(255,255,255,0.05)',
                    border:'1px solid rgba(255,255,255,0.1)',
                    borderRadius:10,color:'#fff',fontSize:13,
                    outline:'none',boxSizing:'border-box',
                    transition:'border-color 0.15s',
                  }}
                  onFocus={e=>e.target.style.borderColor='rgba(99,102,241,0.5)'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}
                />
              </div>
              <div className="admin-filter-buttons" style={{display:'flex',gap:6}}>
                {[['all','All'],['enabled','Tracking On'],['disabled','Tracking Off']].map(([val,label])=>(
                  <button key={val} onClick={()=>setFilterConsent(val)} style={{
                    padding:'10px 14px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',
                    background: filterConsent===val ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.04)',
                    color:      filterConsent===val ? '#fff' : 'rgba(255,255,255,0.5)',
                    border:     filterConsent===val ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow:  filterConsent===val ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
                    transition:'all 0.15s',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Table card */}
            <div style={{
              background:'rgba(255,255,255,0.02)',
              border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:16,overflow:'hidden',
            }}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontWeight:800,fontSize:15}}>User Management</div>
                <div style={{fontSize:12,background:'rgba(255,255,255,0.06)',padding:'4px 12px',borderRadius:20,color:'rgba(255,255,255,0.5)'}}>
                  {filteredUsers.length} users
                </div>
              </div>

              {loading && users.length===0 ? (
                <div style={{padding:48,textAlign:'center',color:'rgba(255,255,255,0.3)'}}>
                  <div style={{fontSize:32,marginBottom:12,animation:'admin-pulse 1s infinite'}}>⏳</div>
                  Loading users…
                </div>
              ) : filteredUsers.length===0 ? (
                <div style={{padding:48,textAlign:'center',color:'rgba(255,255,255,0.3)'}}>
                  <div style={{fontSize:32,marginBottom:12}}>🔍</div>
                  No users found
                </div>
              ) : (
                <div className="admin-table-wrap" style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                        {['User Info','Tracking','Status','Last Seen','Track','Actions'].map(h=>(
                          <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.08em',whiteSpace:'nowrap'}}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <UserRow
                          key={u.id}
                          u={u}
                          now={now}
                          currentUser={currentUser}
                          isSelected={selectedUserId===u.id}
                          onSelect={setSelectedUserId}
                          onView={setViewUserId}
                          onDelete={handleDeleteUser}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SOS Alerts */}
            {sosAlerts.length>0 && (
              <div style={{marginTop:20,background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:16,padding:'16px 20px'}}>
                <div style={{fontWeight:800,fontSize:14,color:'#ef4444',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                  🆘 SOS Alerts ({sosAlerts.length})
                </div>
                {sosAlerts.slice(0,5).map((s,i)=>(
                  <div key={s.id||i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(239,68,68,0.1)'}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:'#fff'}}>{s.user?.username||'Unknown'}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>
                        lat={Number(s.latitude).toFixed(4)}, lon={Number(s.longitude).toFixed(4)}
                      </div>
                    </div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>{timeAgo(s.created_at)}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-route-replay" style={{marginTop:20,background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:16,padding:'16px 20px',overflow:'hidden'}}>
              <div style={{fontWeight:800,fontSize:14,color:'#a5b4fc',marginBottom:12}}>Route Replay</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.45)',marginBottom:12}}>
                {selectedUser
                  ? <>Showing <strong style={{color:'#fff'}}>{selectedUser.username}</strong>. Choose a date, then press Load Route.</>
                  : 'Click a user row above to select whose journey you want to replay.'}
              </div>
              {selectedUser ? (
                <RouteHistory key={selectedUser.id} userId={currentUser?.id} adminUserId={selectedUser.id} />
              ) : (
                <div style={{padding:'28px 16px',border:'1px dashed rgba(99,102,241,.3)',borderRadius:12,textAlign:'center',color:'rgba(255,255,255,.4)',fontSize:13}}>No user selected</div>
              )}
            </div>
          </div>

          {/* ── Right: Map ──────────────────────────────────────────────────── */}
          <div className="admin-sidebar-panel" style={{
            background:'rgba(255,255,255,0.02)',
            border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:16,overflow:'hidden',
            position:'sticky',top:80,
          }}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:700,fontSize:14}}>Live Map</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',display:'flex',alignItems:'center',gap:5}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',animation:'admin-pulse 1.5s infinite'}}/>
                {activeUsers} live
              </div>
            </div>
            <div style={{height:500, position:'relative'}}>
              <AdminMap
                users={users}
                sosAlerts={sosAlerts}
                selectedUserId={selectedUserId}
                onSelectUserId={setSelectedUserId}
                now={now}
                geofences={geofences}
              />
              {/* Weather widget — uses selected user's location, or first live user, or first user */}
              {(() => {
                const ref = selectedUserId
                  ? users.find(u => u.id === selectedUserId)
                  : users.find(u => u.last_location && (Date.now() - new Date(u.last_location.timestamp).getTime()) < 300000)
                  || users.find(u => u.last_location)
                const loc = ref?.last_location
                return loc ? (
                  <WeatherWidget
                    lat={loc.latitude}
                    lon={loc.longitude}
                    position="bottom-right"
                  />
                ) : null
              })()}
            </div>
            {selectedUserId && (
              <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.06)',background:'rgba(99,102,241,0.05)'}}>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8}}>Selected user</div>
                {(() => {
                  const u = users.find(x=>x.id===selectedUserId)
                  return u ? (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{fontWeight:700,fontSize:13}}>{u.username}</div>
                      <button onClick={()=>setViewUserId(u.id)} style={{
                        padding:'5px 12px',borderRadius:8,fontSize:12,fontWeight:700,
                        background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',
                        color:'#ef4444',cursor:'pointer',
                      }}>👁 Track</button>
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        </div>
        </>
        )}
        </TabErrorBoundary>
      </div>

      {/* ── Emergency SOS overlay ────────────────────────────────────────────── */}
      {emergencyAlert && (
        <div style={{
          position:'fixed',inset:0,zIndex:9999,
          background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <div style={{
            background:'#1a0a0a',border:'2px solid #ef4444',borderRadius:24,
            padding:40,maxWidth:480,width:'90%',textAlign:'center',
            boxShadow:'0 0 60px rgba(239,68,68,0.5)',
            animation:'admin-sos 1.5s infinite',
          }}>
            <div style={{fontSize:64,marginBottom:16,animation:'admin-pulse 0.8s infinite'}}>🆘</div>
            <div style={{fontSize:22,fontWeight:900,color:'#ef4444',marginBottom:8}}>EMERGENCY ALERT</div>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.7)',marginBottom:24}}>Immediate assistance requested</div>
            <div style={{background:'rgba(239,68,68,0.1)',borderRadius:12,padding:16,marginBottom:24,textAlign:'left'}}>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(239,68,68,0.15)'}}>
                <span style={{color:'rgba(255,255,255,0.4)',fontSize:12}}>User</span>
                <span style={{color:'#fff',fontWeight:700,fontSize:12}}>{emergencyAlert.user?.username||'Unknown'}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(239,68,68,0.15)'}}>
                <span style={{color:'rgba(255,255,255,0.4)',fontSize:12}}>Location</span>
                <span style={{color:'#fff',fontWeight:700,fontSize:12}}>{Number(emergencyAlert.latitude).toFixed(4)}, {Number(emergencyAlert.longitude).toFixed(4)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}>
                <span style={{color:'rgba(255,255,255,0.4)',fontSize:12}}>Time</span>
                <span style={{color:'#fff',fontWeight:700,fontSize:12}}>{new Date(emergencyAlert.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:12}}>
              <button onClick={()=>window.open(`https://maps.google.com?q=${emergencyAlert.latitude},${emergencyAlert.longitude}`,'_blank')} style={{
                flex:1,padding:'12px',borderRadius:12,
                background:'#ef4444',border:'none',color:'#fff',
                fontWeight:800,fontSize:14,cursor:'pointer',
              }}>📍 Open Map</button>
              <button onClick={()=>setEmergencyAlert(null)} style={{
                flex:1,padding:'12px',borderRadius:12,
                background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',
                color:'rgba(255,255,255,0.7)',fontWeight:700,fontSize:14,cursor:'pointer',
              }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Live Modal ───────────────────────────────────────────────────────── */}
      {viewUserId && (
        <UserLiveModal
          user={users.find(u=>u.id===viewUserId)}
          onClose={()=>setViewUserId(null)}
        />
      )}
    </div>
  )
}