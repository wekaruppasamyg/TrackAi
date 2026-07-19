import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore, useLocationStore } from './store'
import Navigation from './components/Navigation'
import LoginForm from './components/LoginForm'
import AdminLoginForm from './components/AdminLoginForm'
import MapDashboard from './components/MapDashboard'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import GeofenceManager from './components/GeofenceManager'
import ConsentManager from './components/ConsentManager'
import LocationTracker from './components/LocationTracker'
import AdminDashboard from './components/AdminDashboard'
import RouteHistory from './components/RouteHistory'
import NavigationView from './components/NavigationView'   // ← NEW
import Home from './pages/Home'
import AIAssistant from './components/AIAssistent'
import { authAPI, locationAPI, notificationAPI, sosAPI } from './services/api'
import './App.css'

const SEND_INTERVAL_MS = 15_000

function makeWsUrl(token) {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const wsBase  = apiBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  const base    = wsBase.endsWith('/api') ? wsBase : wsBase.replace(/\/$/, '') + '/api'
  return `${base}/ws/tracking?token=${encodeURIComponent(token || '')}`
}

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user            = useAuthStore((state) => state.user)
  const token           = useAuthStore((state) => state.token)
  const logout          = useAuthStore((state) => state.logout)
  const setToken        = useAuthStore((state) => state.setToken)
  const setUser         = useAuthStore((state) => state.setUser)
  const navigate        = useNavigate()

  const addLocation   = useLocationStore((s) => s.addLocation)
  const setWsConn     = useLocationStore((s) => s.setWsConnected)
  const setIsTracking = useLocationStore((s) => s.setIsTracking)
  const isTracking    = useLocationStore((s) => s.isTracking)

  const [activeTab,        setActiveTab]        = useState('map')
  const [authInitializing, setAuthInitializing] = useState(true)
  const [wsStatus,         setWsStatus]         = useState('idle')
  const [accuracy,         setAccuracy]         = useState(null)
  const [trackingMessage,  setTrackingMessage]  = useState('')
  const [sosSending,       setSosSending]       = useState(false)
  const [sosMessage,       setSosMessage]       = useState('')
  const [voiceNavigation,  setVoiceNavigation]  = useState(null)
  const [adminFocusUser,   setAdminFocusUser]   = useState('')

  const wsRef       = useRef(null)
  const watchIdRef  = useRef(null)
  const intervalRef = useRef(null)
  const latestPos   = useRef(null)
  const lowBatterySentRef = useRef(false)

  const flash = useCallback((msg, ms = 3000) => {
    setTrackingMessage(msg)
    if (ms > 0) setTimeout(() => setTrackingMessage(''), ms)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (!stored) { setAuthInitializing(false); return }
    setToken(stored)
    authAPI.getCurrentUser()
      .then((res) => setUser(res.data))
      .catch(() => { localStorage.removeItem('token'); logout() })
      .finally(() => setAuthInitializing(false))
  }, [])

  const sendPosition = useCallback(async (position) => {
    const { latitude, longitude, accuracy: acc, altitude, speed, heading } = position.coords
    setAccuracy(acc ? Math.round(acc) : null)
    try {
      const res = await locationAPI.createLocation({ latitude, longitude, accuracy: acc, altitude, speed, heading })
      addLocation(res.data)
    } catch (err) {
      flash(`Save error: ${err.response?.data?.detail || err.message}`)
    }
  }, [addLocation, flash])

  const connectWs = useCallback(() => {
    if (!token) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    setWsStatus('connecting')
    let openedOk = false
    const ws = new WebSocket(makeWsUrl(token))
    wsRef.current = ws
    ws.onopen  = () => { openedOk = true; setWsStatus('live'); setWsConn(true) }
    ws.onclose = () => { setWsConn(false); setWsStatus(openedOk ? 'disconnected' : 'no-route') }
    ws.onerror = () => setWsConn(false)
    ws.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data)
        if (d?.type === 'connected') setWsStatus('live')
        if (d?.type === 'geofence_alert')
          flash(`📍 ${d.event === 'enter' ? 'Entered' : 'Left'}: ${d.name}`, 5000)
      } catch { /* ignore */ }
    }
  }, [token, setWsConn, flash])

  const disconnectWs = useCallback(() => {
    try { wsRef.current?.close() } catch { /* ignore */ }
    wsRef.current = null; setWsConn(false); setWsStatus('idle')
  }, [setWsConn])

  const reportNotificationEvent = useCallback(async (type, position = null, metadata = {}) => {
    try {
      await notificationAPI.createEvent({
        type,
        latitude: position?.coords?.latitude ?? metadata.latitude,
        longitude: position?.coords?.longitude ?? metadata.longitude,
        metadata,
      })
    } catch { /* notification reporting should not block the user */ }
  }, [])

  const startTracking = useCallback(() => {
    if (!user?.is_consent_given) { flash('Enable GPS consent in Settings first'); return }
    if (!('geolocation' in navigator)) { flash('Geolocation not supported'); return }
    flash('Acquiring GPS signal…', 0)
    const opts = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { latestPos.current = pos },
      (err) => {
        flash({ 1: 'Location access denied.', 2: 'Position unavailable.', 3: 'GPS timed out.' }[err.code] || 'GPS error')
        if (err.code === 1) reportNotificationEvent('gps_disabled')
        stopTracking()
      },
      opts
    )
    intervalRef.current = setInterval(() => {
      if (latestPos.current) sendPosition(latestPos.current)
    }, SEND_INTERVAL_MS)
    navigator.geolocation.getCurrentPosition(
      (pos) => { latestPos.current = pos; sendPosition(pos); flash('Live tracking started ✓', 3000) },
      () => {},
      opts
    )
    connectWs()
    setIsTracking(true)
  }, [user, sendPosition, connectWs, setIsTracking, flash, reportNotificationEvent])

  useEffect(() => {
    if (!isAuthenticated || user?.is_admin || !navigator.getBattery) return
    let batteryRef = null
    let batteryHandler = null

    const checkBattery = (battery) => {
      const percent = Math.round((battery.level || 0) * 100)
      if (percent <= 20 && !battery.charging && !lowBatterySentRef.current) {
        lowBatterySentRef.current = true
        reportNotificationEvent('battery_low', latestPos.current, { battery_percent: percent })
      }
      if (percent > 30 || battery.charging) lowBatterySentRef.current = false
    }

    navigator.getBattery().then((battery) => {
      batteryRef = battery
      batteryHandler = () => checkBattery(battery)
      checkBattery(battery)
      battery.addEventListener('levelchange', batteryHandler)
      battery.addEventListener('chargingchange', batteryHandler)
    }).catch(() => {})

    return () => {
      if (!batteryRef) return
      try {
        batteryRef.removeEventListener('levelchange', batteryHandler)
        batteryRef.removeEventListener('chargingchange', batteryHandler)
      } catch { /* ignore */ }
    }
  }, [isAuthenticated, user?.is_admin, reportNotificationEvent])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    clearInterval(intervalRef.current); intervalRef.current = null; latestPos.current = null
    disconnectWs(); setIsTracking(false); setAccuracy(null); flash('Tracking stopped', 2000)
  }, [disconnectWs, setIsTracking, flash])

  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    clearInterval(intervalRef.current)
    disconnectWs()
  }, [])

  const handleLogout = () => { stopTracking(); localStorage.removeItem('token'); logout(); navigate('/login') }
  const handleLoginSuccess = () => { setActiveTab('map'); navigate('/') }

  const handleSOS = useCallback(() => {
    if (sosSending) return
    if (!('geolocation' in navigator)) {
      setSosMessage('GPS is not available on this device')
      reportNotificationEvent('gps_disabled')
      return
    }

    setSosSending(true)
    setSosMessage('Sending emergency alert...')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords
          await sosAPI.activate({ latitude, longitude, accuracy, altitude, speed, heading })
          latestPos.current = position
          setSosMessage('SOS sent to admins')
          setTimeout(() => setSosMessage(''), 4000)
        } catch (err) {
          setSosMessage(err.response?.data?.detail || 'Failed to send SOS')
        } finally {
          setSosSending(false)
        }
      },
      (err) => {
        setSosSending(false)
        setSosMessage({ 1: 'Location permission denied', 2: 'Location unavailable', 3: 'GPS timed out' }[err.code] || 'GPS error')
        if (err.code === 1) reportNotificationEvent('gps_disabled')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }, [sosSending, reportNotificationEvent])

  const handleAssistantCommand = useCallback((command) => {
    if (!command?.type) return

    if (command.type === 'start_tracking') {
      setActiveTab('tracking')
      startTracking()
      return
    }

    if (command.type === 'stop_tracking') {
      stopTracking()
      setActiveTab('tracking')
      return
    }

    if (command.type === 'send_sos') {
      handleSOS()
      return
    }

    if (command.type === 'open_admin') {
      setActiveTab('admin')
      return
    }

    if (command.type === 'focus_user') {
      setActiveTab('admin')
      setAdminFocusUser(command.user || '')
    }
  }, [handleSOS, startTracking, stopTracking])

  const handleVoiceSearch = useCallback((request) => {
    if (!request?.destination) return
    setVoiceNavigation({
      destination: request.destination,
      autoStart: !!request.autoStart,
      requestId: Date.now(),
    })
    setActiveTab('navigate')
  }, [])

  const DashboardLayout = (
    <div className="app">
      <Navigation
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t)}
        userName={user?.email || 'User'}
        onLogout={handleLogout}
      />
      <div className="main-container">
        <main className="content">
          {activeTab === 'map'           && <MapDashboard userId={user?.id} />}
          {activeTab === 'map_dashboard' && <MapDashboard userId={user?.id} />}
          {activeTab === 'geofence'      && <GeofenceManager userId={user?.id} />}
          {activeTab === 'tracking'      && (
            <LocationTracker
              wsStatus={wsStatus}
              accuracy={accuracy}
              message={trackingMessage}
              isTracking={isTracking}
              onStart={startTracking}
              onStop={stopTracking}
              isConsent={user?.is_consent_given}
            />
          )}
          {activeTab === 'history'       && <RouteHistory userId={user?.id} />}
          {activeTab === 'navigate'      && (
            <NavigationView
              voiceSearchRequest={voiceNavigation}
            />
          )}
          {activeTab === 'consent'       && <ConsentManager />}
          {activeTab === 'analytics'     && !user?.is_admin && <AnalyticsDashboard userId={user?.id} />}
          {activeTab === 'admin'         && user?.is_admin && <AdminDashboard focusUsername={adminFocusUser} />}
        </main>
      </div>
      {/* AI Assistant — available to all logged-in users */}
      {isAuthenticated && (
        <AIAssistant
          onTabChange={setActiveTab}
          onCommand={handleAssistantCommand}
          onVoiceSearch={handleVoiceSearch}
        />
      )}

      {isAuthenticated && !user?.is_admin && (
        <div className="sos-floating-wrap">
          {sosMessage && <div className="sos-floating-message">{sosMessage}</div>}
          <button
            className={`sos-floating-btn ${sosSending ? 'is-sending' : ''}`}
            onClick={handleSOS}
            disabled={sosSending}
            aria-label="Send SOS emergency alert"
            title="Send SOS emergency alert"
          >
            SOS
          </button>
        </div>
      )}
    </div>
  )

  if (authInitializing) return <div className="content">Loading...</div>

  return (
    <Routes>
      <Route path="/login"         element={!isAuthenticated ? <LoginForm onSuccess={handleLoginSuccess} />      : <Navigate to="/" />} />
      <Route path="/admin-login"   element={!isAuthenticated ? <AdminLoginForm onSuccess={handleLoginSuccess} /> : <Navigate to="/" />} />
      <Route path="/"              element={isAuthenticated ? DashboardLayout : <Home />} />
      <Route path="/map-dashboard" element={isAuthenticated ? DashboardLayout : <Home />} />
      <Route path="*"              element={<Navigate to="/" />} />
    </Routes>
  )
}