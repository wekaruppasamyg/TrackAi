import React, { useEffect, useRef, useState } from 'react'
import MapLibreContainer, { maplibregl } from './MapLibreContainer'
import { Marker } from './MapLibreMarkers'

function makeLiveCarIconHTML() {
  return `
    <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;
        border:2px solid rgba(239,68,68,0.5);
        animation:red-ping 1.4s ease-out infinite;"></div>
      <div style="position:absolute;inset:8px;border-radius:50%;
        border:1.5px solid rgba(239,68,68,0.3);
        animation:red-ping 1.4s ease-out 0.5s infinite;"></div>
      <div style="font-size:30px;line-height:1;
        filter:drop-shadow(0 0 10px rgba(239,68,68,1)) drop-shadow(0 0 20px rgba(239,68,68,0.6));
        animation:car-bob 2s ease-in-out infinite;">🚗</div>
    </div>
    <style>
      @keyframes red-ping {
        0%   { transform:scale(0.8); opacity:0.8; }
        70%  { transform:scale(2);   opacity:0;   }
        100% { transform:scale(0.8); opacity:0;   }
      }
      @keyframes car-bob {
        0%,100% { transform:translateY(0px) scale(1); }
        50%     { transform:translateY(-4px) scale(1.05); }
      }
    </style>
  `
}

export default function UserLiveModal({ user, onClose }) {
  const loc = user?.last_location
  const [tick, setTick] = useState(0)
  const mapRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!user) return null

  const center = loc
    ? [Number(loc.longitude), Number(loc.latitude)]  // [lng, lat]
    : [78, 20]

  const ts = loc?.timestamp ? new Date(loc.timestamp) : null
  const secsAgo = ts ? Math.floor((Date.now() - ts.getTime()) / 1000) : null
  const timeAgo = secsAgo == null ? '—'
    : secsAgo < 60   ? `${secsAgo}s ago`
    : secsAgo < 3600 ? `${Math.floor(secsAgo/60)}m ago`
    : `${Math.floor(secsAgo/3600)}h ago`

  const isLive = secsAgo != null && secsAgo < 900

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.75)',
      backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:16,
    }} onClick={onClose}>
      <div style={{
        width:'100%', maxWidth:720,
        background:'#0f0f14',
        border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:20,
        overflow:'hidden',
        boxShadow:'0 24px 64px rgba(0,0,0,0.7)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding:'16px 20px',
          borderBottom:'1px solid rgba(255,255,255,0.08)',
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div style={{
            width:40, height:40, borderRadius:'50%',
            background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            border:`2px solid ${isLive ? '#ef4444' : '#333'}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:900, fontSize:16, color: isLive ? '#ef4444' : '#555',
          }}>
            {(user.username||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>{user.username}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>{user.email}</div>
          </div>
          <span style={{
            fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20,
            background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            color:      isLive ? '#ef4444' : '#666',
            border:     `1px solid ${isLive ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
          }}>
            {isLive ? '🔴 LIVE' : 'OFFLINE'}
          </span>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:'50%',
            background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.1)',
            color:'rgba(255,255,255,0.6)', fontSize:18,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>×</button>
        </div>

        {/* Map */}
        <div style={{ height:380, position:'relative' }}>
          <style>{`
            /* MapLibre GL popup styling */
            .maplibregl-popup-content {
              background: #1a1a24 !important;
              border: 1px solid rgba(255,255,255,0.1) !important;
              border-radius: 12px !important;
              color: #fff !important;
            }
            .maplibregl-popup-anchor-top .maplibregl-popup-tip {
              border-top-color: #1a1a24 !important;
            }
            .user-live-map {
              border-radius: 12px;
              overflow: hidden;
            }
          `}</style>

          {loc ? (
            <MapLibreContainer
              center={center}
              zoom={16}
              style="streets-v2-dark"
              onMapLoad={(map) => {
                mapRef.current = map
              }}
              className="user-live-map"
            >
              <Marker
                map={mapRef.current}
                position={[loc.latitude, loc.longitude]}
                icon={makeLiveCarIconHTML()}
                popupContent={`
                  <div style="color: #fff; fontFamily: -apple-system, sans-serif; padding: 10px 0;">
                    <div style="fontWeight: 800; marginBottom: 6px;">🔴 ${user.username}</div>
                    <div style="fontSize: 11px; color: rgba(255,255,255,0.5);">Last updated ${timeAgo}</div>
                  </div>
                `}
              />
            </MapLibreContainer>
          ) : (
            <div style={{
              height:'100%', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              color:'rgba(255,255,255,0.3)', gap:12,
            }}>
              <div style={{ fontSize:40 }}>📡</div>
              <div style={{ fontSize:14 }}>No location data available</div>
            </div>
          )}

          {/* Live pulse overlay top-right */}
          {isLive && (
            <div style={{
              position:'absolute', top:12, right:12, zIndex:1000,
              background:'rgba(239,68,68,0.15)',
              border:'1px solid rgba(239,68,68,0.4)',
              borderRadius:20, padding:'5px 12px',
              display:'flex', alignItems:'center', gap:6,
              backdropFilter:'blur(8px)',
            }}>
              <div style={{
                width:8, height:8, borderRadius:'50%', background:'#ef4444',
                animation:'red-ping 1.4s ease-out infinite',
                boxShadow:'0 0 8px rgba(239,68,68,0.8)',
              }}/>
              <span style={{ fontSize:11, fontWeight:700, color:'#ef4444' }}>LIVE TRACKING</span>
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div style={{
          padding:'14px 20px',
          borderTop:'1px solid rgba(255,255,255,0.06)',
          display:'flex', gap:16,
        }}>
          {[
            ['📍 Latitude',  loc ? Number(loc.latitude).toFixed(5)  : '—'],
            ['📍 Longitude', loc ? Number(loc.longitude).toFixed(5) : '—'],
            ['🎯 Accuracy',  loc?.accuracy ? `${Number(loc.accuracy).toFixed(0)} m` : '—'],
            ['🕐 Last seen', timeAgo],
          ].map(([label, val]) => (
            <div key={label} style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:13, fontWeight:700, color: label.includes('seen') && isLive ? '#ef4444' : '#fff' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}