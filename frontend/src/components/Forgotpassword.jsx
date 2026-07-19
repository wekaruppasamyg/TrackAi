import React, { useState, useRef, useEffect } from 'react'
import { authAPI } from '../services/api'

// ── Step constants ─────────────────────────────────────────────────────────
const STEP = { EMAIL: 'email', OTP: 'otp', PASSWORD: 'password', DONE: 'done' }

// ── 6-box OTP input ────────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const inputs = useRef([])

  const digits = (value + '      ').slice(0, 6).split('')

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = [...digits]
      if (next[i] && next[i].trim()) {
        next[i] = ''
        onChange(next.join('').trimEnd())
      } else if (i > 0) {
        next[i - 1] = ''
        onChange(next.join('').trimEnd())
        inputs.current[i - 1]?.focus()
      }
      return
    }
    if (e.key === 'ArrowLeft' && i > 0) { inputs.current[i - 1]?.focus(); return }
    if (e.key === 'ArrowRight' && i < 5) { inputs.current[i + 1]?.focus(); return }
  }

  const handleChange = (i, e) => {
    const ch = e.target.value.replace(/\D/g, '').slice(-1)
    if (!ch) return
    const next = [...digits]
    next[i] = ch
    onChange(next.join('').trim())
    if (i < 5) inputs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus() }
    e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '8px 0' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          style={{
            width: 46, height: 54,
            textAlign: 'center',
            fontSize: 24, fontWeight: 800,
            borderRadius: 12,
            border: `2px solid ${d.trim() ? 'rgba(252,128,25,0.7)' : 'rgba(255,255,255,0.12)'}`,
            background: d.trim() ? 'rgba(252,128,25,0.1)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
            caretColor: '#fc8019',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
      ))}
    </div>
  )
}

// ── Countdown timer ────────────────────────────────────────────────────────
function Countdown({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const id = setInterval(() => setLeft(s => { if (s <= 1) { clearInterval(id); onDone(); return 0 } return s - 1 }), 1000)
    return () => clearInterval(id)
  }, [seconds])
  const m = String(Math.floor(left / 60)).padStart(2, '0')
  const s = String(left % 60).padStart(2, '0')
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{m}:{s}</span>
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ForgotPassword({ onClose }) {
  const [step,     setStep]     = useState(STEP.EMAIL)
  const [email,    setEmail]    = useState('')
  const [otp,      setOtp]      = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [canResend,setCanResend]= useState(false)
  const [resending,setResending]= useState(false)

  const clearErr = () => setError('')

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOTP = async (e) => {
    e?.preventDefault()
    if (!email.trim()) { setError('Please enter your email address'); return }
    setLoading(true); clearErr()
    try {
      await authAPI.forgotPassword(email.trim())
      setStep(STEP.OTP)
      setCanResend(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResending(true); clearErr(); setOtp('')
    try {
      await authAPI.forgotPassword(email.trim())
      setCanResend(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend OTP.')
    } finally {
      setResending(false)
    }
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e?.preventDefault()
    if (otp.trim().length !== 6) { setError('Please enter the full 6-digit OTP'); return }
    setLoading(true); clearErr()
    try {
      await authAPI.verifyOTP(email.trim(), otp.trim())
      setStep(STEP.PASSWORD)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Reset password ────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e?.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); clearErr()
    try {
      await authAPI.resetPassword(email.trim(), otp.trim(), password)
      setStep(STEP.DONE)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. Please start over.')
    } finally {
      setLoading(false)
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, color: '#fff', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  }

  const btnStyle = (primary = true) => ({
    width: '100%', padding: '13px',
    borderRadius: 12, border: 'none',
    fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    background: primary ? '#fc8019' : 'rgba(255,255,255,0.06)',
    color: primary ? '#fff' : 'rgba(255,255,255,0.6)',
    opacity: loading ? 0.6 : 1,
    transition: 'opacity 0.15s, transform 0.1s',
  })

  const steps = [
    { n: 1, label: 'Email'    },
    { n: 2, label: 'Verify'   },
    { n: 3, label: 'Password' },
  ]
  const currentStepN = step === STEP.EMAIL ? 1 : step === STEP.OTP ? 2 : 3

  return (
    /* Overlay */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: '#0f0f14',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 22px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(252,128,25,0.15)',
            border: '1px solid rgba(252,128,25,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🔑</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Reset Password</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {step === STEP.EMAIL    && 'Enter your registered email'}
              {step === STEP.OTP     && `OTP sent to ${email}`}
              {step === STEP.PASSWORD&& 'Choose a new password'}
              {step === STEP.DONE    && 'All done!'}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}>×</button>
        </div>

        {/* Progress steps */}
        {step !== STEP.DONE && (
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '14px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            gap: 0,
          }}>
            {steps.map((s, i) => (
              <React.Fragment key={s.n}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                    background: s.n < currentStepN ? '#fc8019'
                              : s.n === currentStepN ? 'rgba(252,128,25,0.2)'
                              : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${s.n <= currentStepN ? '#fc8019' : 'rgba(255,255,255,0.1)'}`,
                    color: s.n < currentStepN ? '#fff'
                         : s.n === currentStepN ? '#fc8019'
                         : 'rgba(255,255,255,0.25)',
                  }}>
                    {s.n < currentStepN ? '✓' : s.n}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: s.n === currentStepN ? '#fc8019' : 'rgba(255,255,255,0.25)',
                    letterSpacing: '0.04em',
                  }}>{s.label}</div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginBottom: 18,
                    background: s.n < currentStepN
                      ? 'linear-gradient(90deg,#fc8019,rgba(252,128,25,0.4))'
                      : 'rgba(255,255,255,0.07)',
                  }}/>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ padding: '22px' }}>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 14, padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, fontSize: 13, color: '#fca5a5',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── STEP 1: Email ── */}
          {step === STEP.EMAIL && (
            <form onSubmit={handleSendOTP}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: '0.06em',
                textTransform: 'uppercase' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); clearErr() }}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(252,128,25,0.5)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '10px 0 18px' }}>
                We'll send a 6-digit OTP to this address.
              </div>
              <button type="submit" disabled={loading} style={btnStyle()}>
                {loading ? 'Sending OTP…' : 'Send OTP →'}
              </button>
            </form>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === STEP.OTP && (
            <form onSubmit={handleVerifyOTP}>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                  Enter the 6-digit code sent to<br/>
                  <strong style={{ color: '#fff' }}>{email}</strong>
                </div>
                <OTPInput value={otp} onChange={v => { setOtp(v); clearErr() }} />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 12 }}>
                  {!canResend ? (
                    <>Code expires in &nbsp;
                      <span style={{ color: '#fc8019', fontWeight: 700 }}>
                        <Countdown seconds={600} onDone={() => setCanResend(true)} />
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      style={{
                        background: 'none', border: 'none',
                        color: resending ? 'rgba(252,128,25,0.4)' : '#fc8019',
                        cursor: resending ? 'default' : 'pointer',
                        fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                      }}
                    >
                      {resending ? 'Resending…' : '↺ Resend OTP'}
                    </button>
                  )}
                </div>
              </div>

              <button type="submit" disabled={loading || otp.trim().length < 6} style={{
                ...btnStyle(),
                opacity: loading || otp.trim().length < 6 ? 0.4 : 1,
              }}>
                {loading ? 'Verifying…' : 'Verify OTP →'}
              </button>

              <button type="button" onClick={() => { setStep(STEP.EMAIL); setOtp(''); clearErr() }}
                style={{ ...btnStyle(false), marginTop: 10 }}>
                ← Change email
              </button>
            </form>
          )}

          {/* ── STEP 3: New password ── */}
          {step === STEP.PASSWORD && (
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                  color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: '0.06em',
                  textTransform: 'uppercase' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearErr() }}
                    required
                    style={{ ...inputStyle, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = 'rgba(252,128,25,0.5)'}
                    onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                    color: 'rgba(255,255,255,0.4)',
                  }}>{showPw ? '🔒' : '👁️'}</button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3,4].map(n => {
                        const score = password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
                          : password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
                          : password.length >= 8 ? 2 : 1
                        return (
                          <div key={n} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: n <= score
                              ? score >= 4 ? '#22c55e' : score === 3 ? '#84cc16' : score === 2 ? '#f59e0b' : '#ef4444'
                              : 'rgba(255,255,255,0.08)',
                          }}/>
                        )
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                      {password.length < 8 ? 'Too short' : password.length < 10 ? 'Weak' : password.length < 12 ? 'Good' : 'Strong'}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600,
                  color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: '0.06em',
                  textTransform: 'uppercase' }}>Confirm Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); clearErr() }}
                  required
                  style={{
                    ...inputStyle,
                    borderColor: confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(252,128,25,0.5)'}
                  onBlur={e  => e.target.style.borderColor = confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}
                />
                {confirm && confirm !== password && (
                  <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>Passwords do not match</div>
                )}
              </div>

              <button type="submit"
                disabled={loading || password.length < 8 || password !== confirm}
                style={{
                  ...btnStyle(),
                  opacity: loading || password.length < 8 || password !== confirm ? 0.4 : 1,
                }}
              >
                {loading ? 'Saving…' : '✓ Reset Password'}
              </button>
            </form>
          )}

          {/* ── DONE ── */}
          {step === STEP.DONE && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(34,197,94,0.15)',
                border: '2px solid rgba(34,197,94,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 16px',
              }}>✓</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 8 }}>
                Password Updated!
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.6 }}>
                Your password has been reset successfully.<br/>You can now sign in with your new password.
              </div>
              <button onClick={onClose} style={btnStyle()}>
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}