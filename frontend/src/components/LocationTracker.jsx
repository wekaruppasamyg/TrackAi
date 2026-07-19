import React from 'react'

const WS_LABEL = {
  idle:         { icon: '⚫', text: 'Not started',      cls: '' },
  connecting:   { icon: '🟡', text: 'Connecting…',      cls: 'ws-connecting' },
  live:         { icon: '🟢', text: 'Live',             cls: 'ws-ok' },
  'no-route':   { icon: '🟡', text: 'Connecting…',      cls: 'ws-connecting' },
  disconnected: { icon: '🟡', text: 'Reconnecting…',    cls: 'ws-connecting' },
}

export default function LocationTracker({
  wsStatus   = 'idle',
  accuracy   = null,
  message    = '',
  isTracking = false,
  onStart,
  onStop,
  isConsent  = false,
}) {
  const wsInfo = WS_LABEL[wsStatus] || WS_LABEL.idle

  return (
    <div className="location-tracker">
      <div className="tracker-card">

        <div className="tracker-header">
          <h3>📍 Live Location Tracking</h3>
          {isTracking && (
            <span className="live-badge">
              <span className="live-dot" />
              LIVE
            </span>
          )}
        </div>

        <p className="tracker-desc">
          {isTracking
            ? 'Broadcasting live — every GPS update is sent instantly.'
            : 'Start live tracking or send your location once.'}
        </p>

        {!isConsent && (
          <p className="tracker-warning">
            ⚠️ Go to Settings to enable GPS tracking consent
          </p>
        )}

        {isTracking && (
          <div className="tracker-stats">
            {accuracy != null && (
              <div className="tracker-stat">
                <span className="tracker-stat-label">Accuracy</span>
                <span className="tracker-stat-value">±{accuracy} m</span>
              </div>
            )}
            <div className="tracker-stat">
              <span className="tracker-stat-label">Signal</span>
              <span className={`tracker-stat-value ${wsInfo.cls}`}>
                {wsInfo.icon} {wsInfo.text}
              </span>
            </div>
          </div>
        )}

        <div className="tracker-actions">
          {!isTracking ? (
            <button
              className="btn-track-start"
              onClick={onStart}
              disabled={!isConsent}
            >
              ▶ Start Live Tracking
            </button>
          ) : (
            <button className="btn-track-stop" onClick={onStop}>
              ⏹ Stop Tracking
            </button>
          )}
        </div>

        {message && (
          <small className={`tracker-message ${
            message.startsWith('Save error') || message.startsWith('GPS Error')
              ? 'tracker-message--error'
              : ''
          }`}>
            {message}
          </small>
        )}

      </div>
    </div>
  )
}