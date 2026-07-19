/**
 * WeatherWidget
 * Floating weather panel that sits over any map as an absolute overlay.
 * Connects to Open-Meteo (free, no API key) using lat/lon.
 *
 * Props:
 *   lat, lon      — coordinates to fetch weather for
 *   position      — 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
 *                   default: 'bottom-left'
 *   style         — optional extra inline style for the outer wrapper
 */

import React, { useState } from 'react'
import useWeather from './Useweather'

const WARNING_COLORS = {
  danger:  { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  text: '#fca5a5' },
  warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', text: '#fde68a' },
  info:    { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.35)', text: '#c7d2fe' },
}

const POSITIONS = {
  'top-right':    { top: 16,    right: 16,   bottom: 'auto', left: 'auto'  },
  'bottom-right': { bottom: 16, right: 16,   top: 'auto',    left: 'auto'  },
  'top-left':     { top: 16,    left: 16,    bottom: 'auto', right: 'auto' },
  'bottom-left':  { bottom: 16, left: 16,    top: 'auto',    right: 'auto' },
}

export default function WeatherWidget({ lat, lon, position = 'bottom-left', style = {} }) {
  const { weather, loading, error, refresh } = useWeather(lat, lon)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const pos = POSITIONS[position] || POSITIONS['bottom-left']

  if (dismissed) return null

  // ── collapsed pill (shown when not expanded) ───────────────────────────────
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        title="Click for full weather"
        style={{
          position:      'absolute',
          zIndex:        1100,
          cursor:        'pointer',
          ...pos,
          ...style,
          display:       'flex',
          alignItems:    'center',
          gap:           8,
          padding:       '7px 13px',
          borderRadius:  999,
          background:    'rgba(15,15,20,0.88)',
          backdropFilter:'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border:        '1px solid rgba(255,255,255,0.09)',
          boxShadow:     '0 4px 20px rgba(0,0,0,0.5)',
          fontSize:      13,
          fontWeight:    700,
          color:         '#fff',
          userSelect:    'none',
          transition:    'border-color 0.15s',
        }}
      >
        {loading && <span style={{ fontSize: 16 }}>⏳</span>}
        {error   && <span style={{ fontSize: 16 }}>🌡️</span>}
        {weather && !loading && (
          <>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{weather.icon}</span>
            <span>{weather.temp != null ? `${weather.temp.toFixed(0)}°C` : '—'}</span>
            <span style={{ fontSize: 11, opacity: 0.5 }}>{weather.label}</span>
            {weather.warnings?.length > 0 && (
              <span style={{
                marginLeft: 2, fontSize: 10, fontWeight: 800,
                background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 20, padding: '1px 6px',
              }}>
                {weather.warnings.length} ⚠
              </span>
            )}
          </>
        )}
        {!weather && !loading && !error && <span style={{ opacity: 0.4, fontSize: 12 }}>Weather</span>}
      </div>
    )
  }

  // ── expanded panel ─────────────────────────────────────────────────────────
  return (
    <div style={{
      position:      'absolute',
      zIndex:        1100,
      width:         264,
      ...pos,
      ...style,
      background:    'rgba(15,15,20,0.92)',
      backdropFilter:'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border:        '1px solid rgba(255,255,255,0.09)',
      borderRadius:  18,
      boxShadow:     '0 8px 40px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset',
      overflow:      'hidden',
      fontFamily:    'ui-sans-serif, system-ui, -apple-system, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        padding:      '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display:      'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
            Weather
          </span>
          {weather && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
              {weather.updatedAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
        </div>
        <button onClick={refresh} title="Refresh" style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>↻</button>
        <button onClick={() => setExpanded(false)} title="Collapse" style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>−</button>
        <button onClick={() => { setDismissed(true) }} title="Close" style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          Fetching weather…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🌡️</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{error}</div>
          <button onClick={refresh} style={{
            marginTop: 10, padding: '5px 14px', borderRadius: 20,
            background: 'rgba(252,128,25,0.15)', border: '1px solid rgba(252,128,25,0.3)',
            color: '#fc8019', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>Retry</button>
        </div>
      )}

      {/* Weather data */}
      {weather && !loading && (
        <>
          {/* Main temp + condition */}
          <div style={{
            padding: '14px 16px 10px',
            display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>{weather.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>
                {weather.temp != null ? `${weather.temp.toFixed(0)}°` : '—'}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>C</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3, lineHeight: 1.3 }}>
                {weather.label}
              </div>
              {weather.feelsLike != null && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  Feels like {weather.feelsLike.toFixed(0)}°C
                </div>
              )}
            </div>
          </div>

          {/* Stats grid: Rain, Wind, Humidity */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            padding: '10px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            gap: 6,
          }}>
            {[
              {
                icon: '🌧️',
                label: 'Rain chance',
                value: weather.rainPct != null ? `${weather.rainPct}%` : (weather.precipitation > 0 ? `${weather.precipitation.toFixed(1)} mm` : '0%'),
              },
              {
                icon: '💨',
                label: 'Wind',
                value: `${weather.windSpeed.toFixed(0)} km/h`,
                sub: weather.windDir,
              },
              {
                icon: '💧',
                label: 'Humidity',
                value: weather.humidity != null ? `${weather.humidity}%` : '—',
              },
            ].map(item => (
              <div key={item.label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '8px 6px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, lineHeight: 1, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{item.value}</div>
                {item.sub && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{item.sub}</div>
                )}
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 3,
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Wind gust */}
          {weather.windGusts > 0 && (
            <div style={{
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>💨 Wind gusts</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: weather.windGusts > 50 ? '#fbbf24' : '#fff' }}>
                {weather.windGusts.toFixed(0)} km/h
              </span>
            </div>
          )}

          {/* Warnings */}
          {weather.warnings?.length > 0 && (
            <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {weather.warnings.map((w, i) => {
                const c = WARNING_COLORS[w.level] || WARNING_COLORS.info
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 10px', borderRadius: 10,
                    background: c.bg, border: `1px solid ${c.border}`,
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{w.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.text, lineHeight: 1.3 }}>{w.text}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* No warnings state */}
          {(!weather.warnings || weather.warnings.length === 0) && (
            <div style={{
              padding: '8px 14px 12px',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>No weather warnings</span>
            </div>
          )}
        </>
      )}

      {/* No coords yet */}
      {!lat && !lon && !loading && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Waiting for GPS location…
        </div>
      )}
    </div>
  )
}