import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '../store'
import { authAPI } from '../services/api'
import ManModelViewer from './Manmodelviewer'
import '../styles/auth.css' // Re-use existing auth styles

export default function AdminLoginForm({ onSuccess }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const setUser = useAuthStore((state) => state.setUser)
  const setToken = useAuthStore((state) => state.setToken)

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('')
    setLoading(true)
    try {
      // Same endpoint the user-side Google login uses. The dashboard itself
      // (App.jsx) already shows/hides admin-only views based on the
      // returned user's is_admin flag — so there's nothing to branch on
      // here, this just signs them in like any other Google login.
      const response = await authAPI.googleLogin({
        credential: credentialResponse.credential,
      })

      localStorage.setItem('token', response.data.access_token)
      setToken(response.data.access_token)
      setUser(response.data.user)
      onSuccess()
    } catch (err) {
      console.error('Admin Google Login Error:', err)
      setError('Google login failed.')
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__form">
        <div className="auth-container auth-container--admin">
          <Link to="/" className="auth-brand" aria-label="TrackAI home">
            <img src="/trackai-logo-512.png" alt="TrackAI logo" />
            <span>TrackAI</span>
          </Link>

          <Link to="/" className="auth-back-home" aria-label="Back to home">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>

          <div className="auth-form auth-form--admin">
            <div className="auth-eyebrow">
              <span className="dot" aria-hidden="true" />
              RESTRICTED CONSOLE
            </div>

            <header>
              <h1>Admin Portal</h1>
              <p>Sign in with the authorized Google account</p>
            </header>

            {error && <div className="error-message">{error}</div>}

            <div className="auth-google-row">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Login Failed')}
                   theme="filled_black"
  size="large"
  shape="pill"
              />
            </div>

            {loading && <div className="auth-google-status">Verifying access…</div>}

            <div className="admin-portal-link">
              <Link to="/login">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to User Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-page__visual auth-page__visual--white">
        <ManModelViewer />
        {/* Terminal */}
  <div className="terminal-box">

      <p> Booting AI Engine...</p>
      <p> Connecting Satellites...</p>
      <p> GPS Connected</p>
      <p> Ready to Track</p>

  </div>

      </div>
      
    </div>
  )
}