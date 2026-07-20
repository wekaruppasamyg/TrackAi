import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleLogin } from "@react-oauth/google"
import { useAuthStore } from '../store'
import { authAPI } from '../services/api'
import ManModelViewer from './Manmodelviewer'
import '../styles/auth.css'
import ForgotPassword from "./Forgotpassword"

export default function LoginForm({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const setUser = useAuthStore((state) => state.setUser)
  const setToken = useAuthStore((state) => state.setToken)

  const resetFields = () => {
    setUsername('')
    setPassword('')
    setName('')
    setEmail('')
    setError('')
  }

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value)
    if (error) setError('') // Clear error when user starts typing
  }

  const handleModeSelect = (signUp) => {
    if (signUp === isSignUp) return
    setIsSignUp(signUp)
    resetFields()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('') // Reset error state on new attempt

    if (password.length < 8) {
      setError('Password too short (min 8 characters)')
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        await authAPI.register({
          username,
          email,
          password,
          full_name: name,
        })
      }

      // Normal Login Flow
      const response = await authAPI.login({ username, password })
      localStorage.setItem('token', response.data.access_token)
      setToken(response.data.access_token)

      const userRes = await authAPI.getCurrentUser()
      setUser(userRes.data)
      onSuccess()
    } catch (err) {
      console.error('Login Error:', err)
      if (err.response?.status === 401) {
        setError('Invalid username or password')
      } else if (err.response) {
        // Check for FastAPI detail which can be a string or an object/array
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else {
        setError(Array.isArray(detail) ? detail[0].msg : (detail || 'An error occurred during login'))
        }
      } else if (err.request) {
        let apiURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
        
        // Alert the user if they likely forgot the /api suffix
        if (!apiURL.endsWith('/api')) {
          apiURL += ' (Warning: Missing /api suffix)'
        }
        
        console.error('Network Error Details:', err.request)
        setError(`Server unreachable at ${apiURL}. Please ensure the backend is running.`)
      } else {
        setError('An unexpected error occurred.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__form">
        <div className="auth-container">
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

          <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-eyebrow">
          <span className="dot" aria-hidden="true" />
          TRACKAI SECURE ACCESS
        </div>

        <header>
          <h1>{isSignUp ? 'Create Account' : 'User Login'}</h1>
          <p>{isSignUp ? 'Join the TrackAI tracking network' : 'Sign in to access your live dashboard'}</p>
        </header>

        {error && <div className="error-message">{error}</div>}

        {isSignUp && (
          <>
            <div className="auth-input-group">
              <span className="auth-input-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={handleInputChange(setName)}
                required
              />
            </div>

            <div className="auth-input-group">
              <span className="auth-input-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 5L2 7" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={handleInputChange(setEmail)}
                required
              />
            </div>
          </>
        )}

        <div className="auth-input-group">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={handleInputChange(setUsername)}
            required
          />
        </div>

        <div className="auth-input-group password-wrapper">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={handleInputChange(setPassword)}
            required
          />
          <span className="password-toggle" onClick={() => setShowPassword(!showPassword)} role="button" aria-label="Toggle password visibility">
            {showPassword ? '🔒' : '👁️'}
          </span>
        </div>

        {!isSignUp && (
          <div className="auth-row">
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember Me
            </label>
          <button
  type="button"
  className="auth-forgot"
  onClick={() => setShowForgotPassword(true)}
>
  Forgot Password?
</button>
          </div>
        )}

        <div className="auth-split-action">
          <button
            type={isSignUp ? 'button' : 'submit'}
            className="auth-split-btn"
            data-active={!isSignUp}
            disabled={loading}
            onClick={isSignUp ? () => handleModeSelect(false) : undefined}
          >
            {loading && !isSignUp ? 'Signing In...' : 'Sign In'}
          </button>
          <span className="auth-split-or" aria-hidden="true">OR</span>
          <button
            type={isSignUp ? 'submit' : 'button'}
            className="auth-split-btn"
            data-active={isSignUp}
            disabled={loading}
            onClick={!isSignUp ? () => handleModeSelect(true) : undefined}
          >
            {loading && isSignUp ? 'Creating...' : 'Register'}
          </button>
        </div>

        <div className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
          <span onClick={() => handleModeSelect(!isSignUp)}>
            {isSignUp ? 'Sign in instead' : 'Create one'}
          </span>
        </div>
<div
  style={{
    marginTop: "20px",
    display: "flex",
    justifyContent: "center",
  }}
>
 <GoogleLogin
  onSuccess={async (credentialResponse) => {
    try {
      const response = await authAPI.googleLogin({
        credential: credentialResponse.credential,
      });

      localStorage.setItem(
        "token",
        response.data.access_token
      );

      setToken(response.data.access_token);

      setUser(response.data.user);

      onSuccess(); // Opens your dashboard

    } catch (error) {
      console.error(error);
      setError("Google login failed.");
    }
  }}
  onError={() => {
    setError("Google Login Failed");
      }}

    theme="filled_black"
  size="large"
  shape="pill"
/>
</div>
        {!isSignUp && (
          <div className="admin-portal-link">
            <Link to="/admin-login">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 6v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V6l-8-4Z" />
              </svg>
              Access Admin Portal
            </Link>
          </div>
        )}
          </form>
        </div>
      </div>

      <div className="auth-page__visual auth-page__visual--white">



  {/* Speech Bubble */}


  {/* 3D Model */}
  <ManModelViewer />


  {/* Terminal */}
  <div className="terminal-box">

      <p> Booting AI Engine...</p>
      <p> Connecting Satellites...</p>
      <p> GPS Connected</p>
      <p> Ready to Track</p>

  </div>

</div>
      {showForgotPassword && (
  <ForgotPassword
    onClose={() => setShowForgotPassword(false)}
  />
)}
    </div>
  )
}