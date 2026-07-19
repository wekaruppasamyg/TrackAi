import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store'
import { authAPI, locationAPI } from '../services/api'
import '../styles/components.css'

export default function ConsentManager() {
  const { user, setUser } = useAuthStore((state) => ({ user: state.user, setUser: state.setUser }))
  const [consentGiven, setConsentGiven] = useState(user?.is_consent_given || false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleConsentChange = async (e) => {
    const newConsent = e.target.checked
    setLoading(true)

    try {
      await authAPI.updateConsent(newConsent)
      
      // Update global store so LocationTracker is notified
      setUser({ ...user, is_consent_given: newConsent })
      
      setConsentGiven(newConsent)
      setMessage(newConsent 
        ? '✓ GPS tracking enabled' 
        : '✓ GPS tracking disabled'
      )
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      console.error("Consent Update Error:", err);
      const detail = err.response?.data?.detail;
      setMessage(`Error: ${detail || 'Failed to update consent (Server Error 500)'}`);
      setConsentGiven(!newConsent)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="consent-manager">
      <div className="consent-card">
        <h3>📍 GPS Tracking Permission</h3>
        <p>Enable GPS tracking to share your location data with the platform.</p>
        <div className="consent-toggle">
          <label>
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={handleConsentChange}
              disabled={loading}
            />
            {loading ? 'Updating...' : 'Allow GPS Tracking'}
          </label>
          {message && <small className="consent-message">{message}</small>}
        </div>
      </div>
    </div>
  )
}
