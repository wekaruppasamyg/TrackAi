import React, { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls, Bounds } from '@react-three/drei'
import { useAuthStore } from '../store'
import '../styles/home.css'

// ── Generic GLB loader ─────────────────────────────────────────────────────────
// Loads any .glb from /public/3d/<file>.glb (served at runtime as /3d/<file>.glb)
function GLBModel({ url, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} scale={scale} position={position} rotation={rotation} />
}

// ── Robot.glb — big centerpiece viewer ─────────────────────────────────────────
// Bounds auto-frames the model so the whole thing (head included) is always
// visible, no matter what scale it was exported at — no manual numbers to guess.
function RobotCenterViewer() {
  return (
    <div className="hp-robot-center">
      <Canvas camera={{ fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <GLBModel url="/3d/Robot.glb" />
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={2.2} />
      </Canvas>
    </div>
  )
}

// ── mini_robot.glb — small "camera" preview widget, fixed top-right ───────────
function MiniRobotCam() {
  return (
    <div className="hp-mini-robot-cam">
      <Canvas camera={{ fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 3, 2]} intensity={1.2} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.3}>
            <GLBModel url="/3d/mini_robot.glb" />
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={4} />
      </Canvas>
      <span className="hp-mini-robot-cam-label">LIVE</span>
    </div>
  )
}

// ── build.glb — full-width footer banner ────────────────────────────────────────
function FooterBuildViewer() {
  return (
    <div className="hp-footer-3d">
      <Canvas camera={{ fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 5, 2]} intensity={1.3} />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.15}>
            <GLBModel url="/3d/footer.glb" />
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.5} />
      </Canvas>
    </div>
  )
}

// Pre-warm all three models so they're cached before the sections mount
useGLTF.preload('/3d/Robot.glb')
useGLTF.preload('/3d/mini_robot.glb')
useGLTF.preload('/3d/footer.glb')

// ── Scroll progress bar ────────────────────────────────────────────────────────
function ScrollProgress() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el  = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      setPct(max > 0 ? (window.scrollY / max) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="scroll-progress-bar" style={{ width: `${pct}%` }} />
  )
}

// ── Reveal wrapper — slides + fades in on scroll ───────────────────────────────
function Reveal({ children, delay = 0, from = 'bottom', className = '' }) {
  const ref  = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect() } },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const transforms = {
    bottom: 'translateY(40px)',
    left:   'translateX(-40px)',
    right:  'translateX(40px)',
    scale:  'scale(0.92)',
    none:   'none',
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'none' : transforms[from] || transforms.bottom,
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}

// ── Parallax wrapper ───────────────────────────────────────────────────────────
function Parallax({ children, speed = 0.15, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const mid  = window.innerHeight / 2
      const delta = (rect.top + rect.height / 2 - mid) * speed
      el.style.transform = `translateY(${delta}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [speed])

  return <div ref={ref} className={className}>{children}</div>
}

// ── Animated counter ───────────────────────────────────────────────────────────
function Counter({ value, suffix = '', label }) {
  const ref     = useRef(null)
  const [n, setN] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start    = performance.now()
        const duration = 1200
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - (1 - t) ** 4
          setN(Math.round(value * eased * 10) / 10)
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        io.disconnect()
      }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [value])

  return (
    <div ref={ref} className="stat-card">
      <div className="stat-card-value">{n}<span className="stat-card-suffix">{suffix}</span></div>
      <div className="stat-card-label">{label}</div>
    </div>
  )
}

// ── Radar console (unchanged logic, new class names) ──────────────────────────
function RadarConsole() {
  const feed = useMemo(() => [
    { lat: '9.9252° N',  lon: '78.1198° E', tag: 'UNIT-01' },
    { lat: '13.0827° N', lon: '80.2707° E', tag: 'UNIT-02' },
    { lat: '28.6139° N', lon: '77.2090° E', tag: 'UNIT-03' },
    { lat: '19.0760° N', lon: '72.8777° E', tag: 'UNIT-04' },
    { lat: '12.9716° N', lon: '77.5946° E', tag: 'UNIT-05' },
  ], [])

  const [activeRow, setActiveRow] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActiveRow(r => (r + 1) % feed.length), 1600)
    return () => clearInterval(id)
  }, [feed.length])

  return (
    <div className="radar-console">
      <div className="rc-header">
        <div className="rc-header-left">
          <span className="rc-dot rc-dot--live" />
          <span className="rc-label">LIVE FEED</span>
        </div>
        <span className="rc-label rc-label--green">SIG 98%</span>
      </div>

      <div className="rc-radar-wrap">
        <svg viewBox="0 0 220 220" className="rc-svg">
          <defs>
            <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(57,255,136,0.35)" />
              <stop offset="100%" stopColor="rgba(57,255,136,0)" />
            </radialGradient>
          </defs>
          <circle cx="110" cy="110" r="100" className="rc-ring" />
          <circle cx="110" cy="110" r="68"  className="rc-ring" />
          <circle cx="110" cy="110" r="36"  className="rc-ring" />
          <line x1="110" y1="10"  x2="110" y2="210" className="rc-axis" />
          <line x1="10"  y1="110" x2="210" y2="110" className="rc-axis" />
          <g className="rc-sweep">
            <path d="M110 110 L110 10 A100 100 0 0 1 184 64 Z" fill="url(#sweepGrad)" />
          </g>
          <circle cx="142" cy="78"  r="4" className="rc-blip" style={{ animationDelay: '0s' }} />
          <circle cx="76"  cy="132" r="4" className="rc-blip" style={{ animationDelay: '0.7s' }} />
          <circle cx="150" cy="146" r="4" className="rc-blip" style={{ animationDelay: '1.4s' }} />
          <circle cx="80"  cy="70"  r="3" className="rc-blip" style={{ animationDelay: '0.3s' }} />
          <circle cx="110" cy="110" r="3" fill="var(--tk-text)" />
        </svg>
      </div>

      <div className="rc-feed">
        {feed.map((row, i) => (
          <div key={row.tag} className={`rc-feed-row ${i === activeRow ? 'rc-feed-row--active' : ''}`}>
            <span className="rc-feed-tag">{row.tag}</span>
            <span className="rc-feed-coords">{row.lat} &nbsp;{row.lon}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Floating particles on hero ─────────────────────────────────────────────────
function HeroParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x:  Math.random() * 100,
      y:  Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      delay: Math.random() * 6,
      dur:   4 + Math.random() * 6,
    })), [])

  return (
    <div className="hero-particles" aria-hidden="true">
      {particles.map(p => (
        <div key={p.id} className="hero-particle" style={{
          left:            `${p.x}%`,
          top:             `${p.y}%`,
          width:           `${p.size}px`,
          height:          `${p.size}px`,
          animationDelay:  `${p.delay}s`,
          animationDuration:`${p.dur}s`,
        }} />
      ))}
    </div>
  )
}

// ── Horizontal scrolling feature ticker ───────────────────────────────────────
function FeatureTicker() {
  const items = [
    '🛰 Real-time GPS', '🔵 Geofencing', '📊 Analytics', '🤖 AI Assistant',
    '🆘 SOS Alerts', '🗺 Route History', '🧭 Navigation', '🔒 Consent-first',
    '⚡ WebSocket Live', '📍 Reverse Geocode', '📈 Pattern Detection', '🔮 Predictive AI',
  ]
  return (
    <div className="ticker-wrap" aria-hidden="true">
      <div className="ticker-track">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="ticker-item">{item}</span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const navigate        = useNavigate()
  const heroRef         = useRef(null)

  // Parallax hero background
  useEffect(() => {
    const onScroll = () => {
      if (!heroRef.current) return
      const y = window.scrollY
      heroRef.current.style.setProperty('--hero-scroll', `${y * 0.4}px`)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (isAuthenticated) return null

  const features = [
    {
      n: '01', icon: '📡',
      title: 'Live map tracking',
      desc:  'Watch every unit move in real time on a console-style map with live coordinate readouts.',
      color: 'rgba(57,255,136,0.12)',
    },
    {
      n: '02', icon: '🔵',
      title: 'Geofence boundaries',
      desc:  'Draw a radius around any point and get notified the moment a unit crosses it.',
      color: 'rgba(99,102,241,0.12)',
    },
    {
      n: '03', icon: '🤖',
      title: 'AI Assistant',
      desc:  'Ask "where am I?" or "who is online?" — the AI answers with real-time DB data.',
      color: 'rgba(139,92,246,0.12)',
    },
    {
      n: '04', icon: '🔒',
      title: 'Consent-first',
      desc:  'Location sharing stays off until a user explicitly opts in — full control, always.',
      color: 'rgba(239,68,68,0.10)',
    },
    {
      n: '05', icon: '🧭',
      title: 'Turn-by-turn nav',
      desc:  'Enter a destination and follow the route live — map follows you as you move.',
      color: 'rgba(245,158,11,0.10)',
    },
    {
      n: '06', icon: '🆘',
      title: 'SOS alerts',
      desc:  'One-tap emergency ping that fires your exact coordinates to every admin instantly.',
      color: 'rgba(239,68,68,0.12)',
    },
  ]

  const steps = [
    { n: '01', title: 'Sign up',      desc: 'Create your account in seconds — username, email, password.' },
    { n: '02', title: 'Grant consent',desc: 'Turn on GPS tracking from Settings whenever you\'re ready.' },
    { n: '03', title: 'Go live',      desc: 'Your position streams to the map instantly with full AI support.' },
  ]

  return (
    <div className="hp-root">
      <ScrollProgress />

      {/* mini_robot.glb — floating camera-style widget, top-right, always visible */}
      <MiniRobotCam />

      {/* ── Topbar ── */}
      <header className="hp-topbar">
        <div className="hp-brand">
          {/* Drop your logo file at frontend/public/logo.png — this reads it from there */}
          <img src="/trackai-logo-512.png" alt="TrackAI logo" className="hp-logo-img" />
          <div>
            <div className="hp-brand-name">TrackAI</div>
            <div className="hp-brand-sub">GPS Tracking Console</div>
          </div>
        </div>
        <nav className="hp-nav">
          <Link className="hp-nav-link" to="/login">Sign In</Link>
          <button className="hp-nav-cta" onClick={() => navigate('/login')}>Get Started →</button>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="hp-hero" ref={heroRef}>
        <HeroParticles />

        {/* Glowing orbs */}
        <div className="hp-orb hp-orb--1" />
        <div className="hp-orb hp-orb--2" />
        <div className="hp-orb hp-orb--3" />

        <div className="hp-hero-inner">
          {/* Left copy */}
          <div className="hp-hero-copy">
            <Reveal from="bottom" delay={0}>
              <div className="hp-badge">
                <span className="hp-badge-dot" />
                REAL-TIME GPS NETWORK
              </div>
            </Reveal>

            <Reveal from="bottom" delay={0.08}>
              <h1 className="hp-h1">
                Know where
                <span className="hp-h1-glow"> everything</span>
                <br />is, the instant
                <br />it moves.
              </h1>
            </Reveal>

            <Reveal from="bottom" delay={0.16}>
              <p className="hp-hero-sub">
                TrackAI streams live coordinates, fences zones with smart alerts,
                and answers your questions with a full AI assistant — all in one console.
              </p>
            </Reveal>

            <Reveal from="bottom" delay={0.24}>
              <div className="hp-hero-btns">
                <Link to="/login" className="hp-btn-primary">
                  Start tracking
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link to="/admin-login" className="hp-btn-ghost">Admin Portal</Link>
              </div>
            </Reveal>

            <Reveal from="bottom" delay={0.3}>
              <div className="hp-hero-chips">
                {['< 2s refresh', 'Opt-in only', 'AI powered', 'Free SOS'].map(c => (
                  <span key={c} className="hp-chip">{c}</span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right: Robot.glb — centerpiece 3D viewer */}
          <Reveal from="right" delay={0.1} className="hp-hero-media">
            <Parallax speed={0.08}>
              <RobotCenterViewer />
            </Parallax>
          </Reveal>
        </div>

        {/* Scroll indicator */}
        <div className="hp-scroll-hint">
          <div className="hp-scroll-mouse">
            <div className="hp-scroll-wheel" />
          </div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* ── Ticker ── */}
      <div className="hp-ticker-section">
        <FeatureTicker />
      </div>

      {/* ── Stats ── */}
      <section className="hp-section hp-stats-section">
        <Reveal from="bottom">
          <div className="hp-section-kicker">By the numbers</div>
          <h2 className="hp-section-title">Built for speed. Designed for trust.</h2>
        </Reveal>
        <div className="hp-stats-grid">
          {[
            { value: 2,     suffix: 's',  label: 'Avg. GPS refresh' },
            { value: 99.9,  suffix: '%',  label: 'Tracking uptime' },
            { value: 15,    suffix: 's',  label: 'Live push interval' },
            { value: 100,   suffix: '%',  label: 'Consent-gated data' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} from="bottom">
              <Counter {...s} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="hp-section">
        <Reveal from="bottom">
          <div className="hp-section-kicker">What's inside</div>
          <h2 className="hp-section-title">Everything the dashboard does, built for this exact job.</h2>
          <p className="hp-section-sub">Six screens, one connected system — every feature designed to work together.</p>
        </Reveal>

        <div className="hp-features-grid">
          {features.map((f, i) => (
            <Reveal key={f.n} delay={i * 0.07} from="bottom">
              <div className="hp-feature-card" style={{ '--card-bg': f.color }}>
                <div className="hp-feature-head">
                  <span className="hp-feature-icon">{f.icon}</span>
                  <span className="hp-feature-num">{f.n}</span>
                </div>
                <div className="hp-feature-title">{f.title}</div>
                <div className="hp-feature-desc">{f.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── AI Highlight ── */}
      <section className="hp-section hp-ai-section">
        <div className="hp-ai-inner">
          <Reveal from="left" delay={0} className="hp-ai-copy">
            <div className="hp-section-kicker">AI powered</div>
            <h2 className="hp-section-title">Ask it anything. It knows everything.</h2>
            <p className="hp-section-sub">
              The built-in AI assistant is connected to your live database. Ask in English, Tamil, Hindi, Telugu, or Malayalam.
            </p>
            <div className="hp-ai-examples">
              {[
                { q: 'Where am I?',           a: '📍 You\'re at Anna Nagar, Chennai, Tamil Nadu — recorded 2 mins ago' },
                { q: 'Who is online now?',     a: '🟢 sanjay is LIVE at Madurai City Centre · ram offline 3h ago' },
                { q: 'How far today?',         a: '📊 You\'ve travelled 14.3 km across 2 trips today' },
              ].map((ex, i) => (
                <Reveal key={i} delay={i * 0.1} from="left">
                  <div className="hp-ai-example">
                    <div className="hp-ai-q">You: {ex.q}</div>
                    <div className="hp-ai-a">AI: {ex.a}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          <Reveal from="right" delay={0.1} className="hp-ai-visual">
            <div className="hp-ai-chat-preview">
              <div className="hp-ai-chat-header">
                <div className="hp-ai-avatar">🤖</div>
                <div>
                  <div className="hp-ai-name">TrackAI Assistant</div>
                  <div className="hp-ai-status"><span className="hp-badge-dot" />Online</div>
                </div>
              </div>
              {[
                { role:'user', text:'எங்கே இருக்கிறேன்?' },
                { role:'ai',   text:'📍 நீங்கள் இப்போது மதுரை, தமிழ்நாடு — அண்ணா நகர் பகுதியில் உள்ளீர்கள். 3 நிமிடங்களுக்கு முன்பு பதிவாகியது.' },
                { role:'user', text:'How far today?' },
                { role:'ai',   text:'📊 You\'ve travelled 14.3 km across 2 trips. Avg speed: 28 km/h.' },
              ].map((m, i) => (
                <div key={i} className={`hp-ai-msg hp-ai-msg--${m.role}`}>{m.text}</div>
              ))}
              <div className="hp-ai-typing">
                <span/><span/><span/>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="hp-section">
        <Reveal from="bottom">
          <div className="hp-section-kicker">Onboarding</div>
          <h2 className="hp-section-title">Three steps from sign-up to signal.</h2>
        </Reveal>

        <div className="hp-steps">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} from="bottom">
              <div className="hp-step">
                <div className="hp-step-line" />
                <div className="hp-step-num">{s.n}</div>
                <div className="hp-step-title">{s.title}</div>
                <div className="hp-step-desc">{s.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="hp-section hp-cta-section">
        <Reveal from="bottom">
          <div className="hp-cta-card">
            <div className="hp-cta-orb" />
            <div className="hp-cta-text">
              <h2>Ready to put your fleet on the map?</h2>
              <p>Create an account and your first location ping can be live in under a minute.</p>
            </div>
            <div className="hp-cta-btns">
              <Link to="/login" className="hp-btn-primary">Create account</Link>
              <Link to="/admin-login" className="hp-btn-ghost">Admin sign in</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        {/* build.glb — footer 3D banner */}
        <FooterBuildViewer />

        <div className="hp-footer-columns">
          <div className="hp-footer-col">
            <img src="/trackai-logo-512.png" alt="TrackAI logo" className="hp-logo-img hp-logo-img--sm" />
          </div>

          <div className="hp-footer-col">
            <div className="hp-footer-col-title">Product</div>
            <Link className="hp-footer-col-link" to="/login">User Login</Link>
            <Link className="hp-footer-col-link" to="/admin-login">Admin Portal</Link>
          </div>

          <div className="hp-footer-col">
            <div className="hp-footer-col-title">Company</div>
            {/* Click to open Gmail compose to this address */}
            <a
              className="hp-footer-col-link"
              href="mailto:wekaruppasamyg23@gmail.com"
            >
              Developed by Karuppasamy G
            </a>
          </div>

          <div className="hp-footer-col">
            <div className="hp-footer-col-title">Connect</div>
            <a className="hp-footer-col-link" href="https://github.com/wekaruppasamyg" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a className="hp-footer-col-link" href="https://www.linkedin.com/in/karuppasamy-g21?utm_source=share_via&utm_content=profile&utm_medium=member_android" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </div>
        </div>

        <div className="hp-footer-divider" />

        <div className="hp-footer-bottom">
          <div className="hp-footer-bottom-left">
            © {new Date().getFullYear()} TrackAI · All rights reserved
          </div>

          <div className="hp-footer-pill">
            <img src="/trackai-logo-512.png" alt="TrackAI logo" className="hp-logo-img hp-logo-img--sm" />
            <span>TrackAI</span>
          </div>

          <div className="hp-footer-socials">
            <a
              className="hp-social-btn"
              href="mailto:wekaruppasamyg23@gmail.com"
              aria-label="Email"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </a>
            <a
              className="hp-social-btn"
              href="https://www.instagram.com/unique_sanjay_____________?igsh=MXJiZTB5YjZ1Z2R5cw=="
              target="_blank" rel="noopener noreferrer" aria-label="Instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              className="hp-social-btn"
              href="https://github.com/wekaruppasamyg"
              target="_blank" rel="noopener noreferrer" aria-label="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.58 2 12.2c0 4.49 2.87 8.3 6.84 9.64.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05a9.3 9.3 0 0 1 2.5-.35c.85 0 1.71.12 2.5.35 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.2C22 6.58 17.52 2 12 2Z" />
              </svg>
            </a>
            <a
              className="hp-social-btn"
              href="https://www.linkedin.com/in/karuppasamy-g21?utm_source=share_via&utm_content=profile&utm_medium=member_android"
              target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}