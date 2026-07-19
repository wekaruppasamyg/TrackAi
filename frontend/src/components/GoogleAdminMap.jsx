import React, { useEffect, useMemo, useRef, useState } from 'react'
import MapLibreContainer, { maplibregl } from './MapLibreContainer'
import { Marker, Circle } from './MapLibreMarkers'

// Car icon — rotates based on heading
function makeCarIconHTML(heading = 0, isLive = true) {
  const color = isLive ? '#4ade80' : '#555'
  const glow  = isLive ? 'drop-shadow(0 0 6px rgba(74,222,128,0.8))' : 'none'
  const pulse = isLive ? `
    <div style="
      position:absolute;inset:-8px;border-radius:50%;
      border:2px solid rgba(74,222,128,0.4);
      animation:car-ping 1.5s ease-out infinite;
    "></div>
    <div style="
      position:absolute;inset:-16px;border-radius:50%;
      border:1.5px solid rgba(74,222,128,0.2);
      animation:car-ping 1.5s ease-out 0.4s infinite;
    "></div>
  ` : ''

  return `
    <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      ${pulse}
      <div style="
        transform:rotate(${heading}deg);
        filter:${glow};
        font-size:26px;
        line-height:1;
        transition:transform 0.5s ease;
      ">🚗</div>
    </div>
    <style>
      @keyframes car-ping {
        0%   { transform:scale(0.8); opacity:0.8; }
        70%  { transform:scale(1.8); opacity:0;   }
        100% { transform:scale(0.8); opacity:0;   }
      }
    </style>
  `
}

// Parked car (offline)
function makeParkedCarIconHTML() {
  return `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;opacity:0.45;">
      <div style="font-size:24px;line-height:1;filter:grayscale(1);">🚗</div>
    </div>
  `
}

const STALE_MS = 300_000
const EARTH_RADIUS_M = 6_371_000

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function AdminMap({
  users,
  sosAlerts = [],
  selectedUserId,
  onSelectUserId,
  now: nowProp,
  // Optional — pass the admin's loaded geofences to draw them as zones on
  // the map and to badge each user's marker with which zone(s) they're in.
  geofences = [],
}) {
  const now = nowProp || Date.now()
  const mapRef = useRef(null)

  const markers = useMemo(() => {
    return users
      .filter((u) => u.last_location?.latitude && u.last_location?.longitude)
      .map((u) => {
        const ts      = u.last_location?.timestamp
          ? new Date(u.last_location.timestamp).getTime()
          : null
        const isLive  = ts ? now - ts <= STALE_MS : false
        const heading = Number(u.last_location?.heading) || 0

        const lat = Number(u.last_location.latitude)
        const lng = Number(u.last_location.longitude)

        // Which active zones is this user's last known position inside?
        const insideZones = geofences.filter(
          (gf) => gf.is_active && haversineMeters(lat, lng, Number(gf.latitude), Number(gf.longitude)) <= Number(gf.radius)
        )

        return {
          userId:    u.id,
          username:  u.username,
          email:     u.email,
          lat,
          lng,
          accuracy:  u.last_location.accuracy,
          speed:     u.last_location.speed,
          timestamp: u.last_location.timestamp,
          isLive,
          heading,
          insideZones,
          iconHTML:  isLive ? makeCarIconHTML(heading, true) : makeParkedCarIconHTML(),
        }
      })
  }, [users, now, geofences])

  const emergencyMarkers = useMemo(() => sosAlerts
    .filter((alert) => alert.latitude != null && alert.longitude != null)
    .map((alert) => ({
      ...alert,
      lat: Number(alert.latitude),
      lng: Number(alert.longitude),
    })), [sosAlerts])

  // Which zones currently have at least one live user inside them —
  // drives the "hot" (occupied) vs "idle" zone coloring on the map.
  const occupiedGeofenceIds = useMemo(() => {
    const ids = new Set()
    markers.forEach((m) => {
      if (!m.isLive) return
      m.insideZones.forEach((gf) => ids.add(gf.id))
    })
    return ids
  }, [markers])

  const center = useMemo(() => {
    const sel = markers.find((m) => m.userId === selectedUserId)
    if (sel) return [sel.lng, sel.lat]  // [lng, lat]
    if (markers.length > 0) return [markers[0].lng, markers[0].lat]
    return [78, 20]
  }, [markers, selectedUserId])

  return (
    <div style={{
      width:'100%', height:'100%', minHeight:500,
      borderRadius:16, overflow:'hidden',
      border:'1px solid rgba(255,255,255,0.08)',
      boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
      position: 'relative',
    }}>
      <style>{`
        /* MapLibre GL popup styling */
        .maplibregl-popup-content {
          background: #1a1a24 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 14px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          padding: 0 !important;
          color: #fff !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        }
        .maplibregl-popup-anchor-top .maplibregl-popup-tip {
          border-top-color: #1a1a24 !important;
        }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
          border-bottom-color: #1a1a24 !important;
        }
        .sos-marker-pulse {
          width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center;
          color: #fff; background: #dc2626; border: 3px solid #fff;
          box-shadow: 0 0 0 0 rgba(239,68,68,.8); animation: sos-map-pulse 1.15s infinite;
        }
        .sos-marker-pulse span { font: 900 11px/1 -apple-system,sans-serif; letter-spacing: 0; }
        @keyframes sos-map-pulse {
          0% { transform: scale(.86); box-shadow: 0 0 0 0 rgba(239,68,68,.8); }
          65% { transform: scale(1); box-shadow: 0 0 0 22px rgba(239,68,68,0); }
          100% { transform: scale(.86); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>

      {geofences.length > 0 && (
        <div style={{
          position:'absolute', top:12, left:12, zIndex:5,
          display:'flex', gap:8, flexWrap:'wrap', maxWidth:'70%',
        }}>
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            background:'rgba(10,10,20,0.75)', backdropFilter:'blur(6px)',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:20,
            padding:'5px 10px', fontSize:11, color:'#fff', fontWeight:600,
          }}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 6px #22c55e'}} />
            Zone occupied
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            background:'rgba(10,10,20,0.75)', backdropFilter:'blur(6px)',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:20,
            padding:'5px 10px', fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600,
          }}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#6366f1'}} />
            Zone idle
          </div>
        </div>
      )}

      <MapLibreContainer
        center={center}
        zoom={markers.length > 0 ? 14 : 5}
        style="streets-v2-dark"
        onMapLoad={(map) => {
          mapRef.current = map
          // Pan to selected user
          const sel = markers.find((m) => m.userId === selectedUserId)
          if (sel) {
            map.flyTo({ center: [sel.lng, sel.lat], zoom: 15, duration: 800 })
          }
        }}
        className="admin-map-dark"
      >
        {/* Geofence zones */}
        {geofences.map((gf) => {
          const isOccupied = occupiedGeofenceIds.has(gf.id)
          const color = !gf.is_active ? '#6b7280' : isOccupied ? '#22c55e' : '#6366f1'
          return (
            <Circle
              key={gf.id}
              map={mapRef.current}
              center={[Number(gf.latitude), Number(gf.longitude)]}
              radius={Number(gf.radius)}
              options={{
                color,
                fillColor: color,
                fillOpacity: !gf.is_active ? 0.03 : isOccupied ? 0.14 : 0.07,
                weight: isOccupied ? 3 : 2,
                dashArray: gf.is_active ? undefined : '4 4',
              }}
            />
          )
        })}

        {/* User markers */}
        {markers.map((m) => (
          <Marker
            key={m.userId}
            map={mapRef.current}
            position={[m.lat, m.lng]}
            icon={m.iconHTML}
            onClick={() => onSelectUserId(m.userId)}
            popupContent={`
              <div style="fontFamily: -apple-system, sans-serif; minWidth: 190px; padding: 14px 16px;">
                <div style="display: flex; alignItems: center; gap: 8px; marginBottom: 10px;">
                  <div style="fontSize: 20px;">🚗</div>
                  <div style="flex: 1;">
                    <div style="fontWeight: 800; fontSize: 13px; color: #fff;">${m.username}</div>
                    <div style="fontSize: 11px; color: rgba(255,255,255,0.35);">${m.email}</div>
                  </div>
                  <span style="fontSize: 10px; fontWeight: 700; padding: 3px 8px; borderRadius: 20px; background: ${m.isLive ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}; color: ${m.isLive ? '#4ade80' : '#555'}; border: 1px solid ${m.isLive ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'};">
                    ${m.isLive ? '● LIVE' : 'PARKED'}
                  </span>
                </div>
                <div style="display: flex; flexDirection: column; gap: 5px;">
                  <div style="display: flex; justifyContent: space-between; fontSize: 11px; padding: 3px 0; borderBottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: rgba(255,255,255,0.35);">Latitude</span>
                    <span style="color: #fff; fontWeight: 600;">${m.lat.toFixed(5)}</span>
                  </div>
                  <div style="display: flex; justifyContent: space-between; fontSize: 11px; padding: 3px 0; borderBottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: rgba(255,255,255,0.35);">Longitude</span>
                    <span style="color: #fff; fontWeight: 600;">${m.lng.toFixed(5)}</span>
                  </div>
                  ${m.accuracy ? `<div style="display: flex; justifyContent: space-between; fontSize: 11px; padding: 3px 0; borderBottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: rgba(255,255,255,0.35);">Accuracy</span>
                    <span style="color: #fff; fontWeight: 600;">${Number(m.accuracy).toFixed(0)} m</span>
                  </div>` : ''}
                  ${m.speed ? `<div style="display: flex; justifyContent: space-between; fontSize: 11px; padding: 3px 0; borderBottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: rgba(255,255,255,0.35);">Speed</span>
                    <span style="color: #fff; fontWeight: 600;">${Number(m.speed).toFixed(1)} m/s</span>
                  </div>` : ''}
                  <div style="display: flex; justifyContent: space-between; fontSize: 11px; padding: 3px 0; borderBottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: rgba(255,255,255,0.35);">Geofence</span>
                    <span style="color: ${m.insideZones.length ? '#4ade80' : 'rgba(255,255,255,0.4)'}; fontWeight: 700;">
                      ${m.insideZones.length ? `Inside · ${m.insideZones.map(z => z.name).join(', ')}` : 'Outside all zones'}
                    </span>
                  </div>
                  ${m.timestamp ? `<div style="fontSize: 11px; color: rgba(255,255,255,0.3); marginTop: 4px; textAlign: right;">${new Date(m.timestamp).toLocaleString()}</div>` : ''}
                </div>
              </div>
            `}
          />
        ))}

        {/* SOS Emergency markers */}
        {emergencyMarkers.map((alert) => (
          <Marker
            key={`sos-${alert.id}`}
            map={mapRef.current}
            position={[alert.lat, alert.lng]}
            icon={`
              <div class="sos-marker-pulse">
                <span>SOS</span>
              </div>
            `}
            popupContent={`
              <div style="fontFamily: -apple-system, sans-serif; minWidth: 190px; padding: 14px 16px;">
                <div style="color: #ef4444; fontWeight: 900; fontSize: 13px; marginBottom: 8px;">SOS EMERGENCY</div>
                <div style="color: #fff; fontWeight: 700;">${alert.user?.full_name || alert.user?.username || 'User'}</div>
                <div style="color: rgba(255,255,255,.55); fontSize: 11px; marginTop: 5px;">${new Date(alert.created_at).toLocaleString()}</div>
              </div>
            `}
          />
        ))}
      </MapLibreContainer>
    </div>
  )
}