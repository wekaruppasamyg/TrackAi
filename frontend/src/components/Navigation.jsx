import React, { useState, useRef, useEffect, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Map,
  Navigation as NavigateIcon,
  Radar,
  Activity,
  History,
  Settings,
  ShieldCheck,
  Search,
  Bell,
  Sparkles,
  ChevronDown,
  LogOut,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react'
import '../styles/navigation.css'

/**
 * TrackAI wordmark — GPS pin + AI circuit + radar wave, inlined so it
 * renders crisp at any size with no extra network request.
 * Recolored to grayscale to match the black & white nav theme.
 */
function TrackAILogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tai-pin" x1="30" y1="18" x2="170" y2="182" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#C9C9C9" />
          <stop offset="1" stopColor="#8A8A8A" />
        </linearGradient>
        <radialGradient id="tai-core" cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g opacity="0.55" stroke="#C9C9C9" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M60,178 A56,20 0 0 0 140,178" opacity="0.35" />
        <path d="M42,178 A74,26 0 0 0 158,178" opacity="0.2" />
      </g>
      <path
        d="M100,18 C61,18 30,49 30,88 C30,138 100,182 100,182 C100,182 170,138 170,88 C170,49 139,18 100,18 Z"
        fill="url(#tai-pin)"
      />
      <circle cx="100" cy="86" r="46" fill="url(#tai-core)" />
      <g stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.92">
        <path d="M100,86 L100,58" />
        <path d="M100,86 L125,101" />
        <path d="M100,86 L75,101" />
        <path d="M100,58 L119,46" />
        <path d="M100,58 L81,46" />
        <path d="M125,101 L125,122" />
        <path d="M75,101 L75,122" />
      </g>
      <g fill="#0A0A0A">
        <circle cx="100" cy="86" r="7.5" />
        <circle cx="100" cy="58" r="5" />
        <circle cx="125" cy="101" r="5" />
        <circle cx="75" cy="101" r="5" />
        <circle cx="119" cy="46" r="4" />
        <circle cx="81" cy="46" r="4" />
        <circle cx="125" cy="122" r="4" />
        <circle cx="75" cy="122" r="4" />
      </g>
    </svg>
  )
}

export default function Navigation({
  activeTab = 'map',
  onTabChange = () => {},
  userName = 'System',
  onLogout = () => {},
  // Additive, optional — existing call sites keep working unchanged.
  notifications = [],
  onSearch = () => {},
  onAIAssistantClick = () => {},
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const mobileMenuRef = useRef(null)
  const profileRef = useRef(null)
  const notifRef = useRef(null)
  const searchRef = useRef(null)
  const layoutGroupId = useId()

  useEffect(() => {
    const handler = (e) => {
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false)
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target) && !searchValue) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileMenuOpen, profileOpen, notifOpen, searchOpen, searchValue])

  const navItems = [
    { label: 'MAP', tab: 'map', Icon: Map },
    { label: 'GEOFENCES', tab: 'geofence', Icon: Radar },
    { label: 'TRACKING', tab: 'tracking', Icon: Activity },
    { label: 'HISTORY', tab: 'history', Icon: History },
    { label: 'SETTINGS', tab: 'consent', Icon: Settings },
    { label: 'ADMIN', tab: 'admin', Icon: ShieldCheck },
  ]

  const handleTabClick = (tab) => {
    onTabChange(tab)
    setMobileMenuOpen(false)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    onSearch(searchValue)
  }

  const unreadCount = notifications.length
  const unreadLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <nav className="nav-container">
      <div className="nav-content">
        <Link to="/" className="nav-logo">
          <TrackAILogoMark size={30} />
          <span className="nav-logo-text">
            Track<span className="nav-logo-accent">AI</span>
          </span>
        </Link>

        <div className="nav-items-desktop" role="menubar">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab
            return (
              <button
                key={item.tab}
                onClick={() => handleTabClick(item.tab)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                role="menuitem"
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId={`nav-active-pill-${layoutGroupId}`}
                    className="nav-item-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <item.Icon className="nav-item-icon" size={15} strokeWidth={2.25} aria-hidden="true" />
                <span className="nav-item-label">{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="nav-right">
          {/* Search */}
          <form
            ref={searchRef}
            className={`nav-search ${searchOpen ? 'open' : ''}`}
            onSubmit={handleSearchSubmit}
            role="search"
          >
            <button
              type="button"
              className="nav-search-toggle"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
            >
              <Search size={16} strokeWidth={2.25} />
            </button>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search devices, locations…"
              className="nav-search-input"
              aria-label="Search devices and locations"
            />
          </form>

          {/* AI Assistant */}
          <button type="button" className="nav-ai-btn" onClick={onAIAssistantClick}>
            <Sparkles size={15} strokeWidth={2.25} aria-hidden="true" />
            <span className="nav-ai-btn-label">Assistant</span>
          </button>

          {/* Notifications */}
          <div className="nav-notif" ref={notifRef}>
            <button
              type="button"
              className="nav-icon-btn"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell size={17} strokeWidth={2.1} />
              {unreadCount > 0 && <span className="nav-notif-badge">{unreadLabel}</span>}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  className="nav-dropdown nav-notif-dropdown"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="nav-dropdown-header">Notifications</div>
                  {notifications.length === 0 ? (
                    <div className="nav-dropdown-empty">You're all caught up.</div>
                  ) : (
                    <ul className="nav-notif-list">
                      {notifications.map((n, idx) => (
                        <li key={n.id ?? idx} className="nav-notif-item">
                          <span className="nav-notif-dot" aria-hidden="true" />
                          <div>
                            <p className="nav-notif-title">{n.title}</p>
                            {n.description && <p className="nav-notif-desc">{n.description}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile dropdown (desktop) */}
          <div className="nav-profile" ref={profileRef}>
            <button
              type="button"
              className="nav-profile-trigger"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
            >
              <span className="nav-user-avatar" aria-hidden="true">
                <UserIcon size={14} strokeWidth={2.25} />
              </span>
              <span className="nav-user-text">{userName}</span>
              <ChevronDown
                size={14}
                strokeWidth={2.25}
                className={`nav-profile-chevron ${profileOpen ? 'open' : ''}`}
              />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  className="nav-dropdown nav-profile-dropdown"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="nav-dropdown-header">{userName}</div>
                  <button
                    type="button"
                    className="nav-dropdown-item nav-dropdown-item-danger"
                    onClick={onLogout}
                  >
                    <LogOut size={15} strokeWidth={2.25} />
                    <span>Sign out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile toggle */}
          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={20} strokeWidth={2.25} />
            ) : (
              <Menu size={20} strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            className="nav-mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <form className="nav-mobile-search" onSubmit={handleSearchSubmit} role="search">
              <Search size={16} strokeWidth={2.25} aria-hidden="true" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search devices, locations…"
                aria-label="Search devices and locations"
              />
            </form>

            <div className="nav-mobile-items">
              {navItems.map((item) => {
                const isActive = activeTab === item.tab
                return (
                  <button
                    key={item.tab}
                    onClick={() => handleTabClick(item.tab)}
                    className={`nav-mobile-item ${isActive ? 'active' : ''}`}
                  >
                    <item.Icon className="nav-mobile-item-icon" size={17} strokeWidth={2.25} aria-hidden="true" />
                    <span className="nav-mobile-item-label">{item.label}</span>
                  </button>
                )
              })}
            </div>

            <button type="button" className="nav-mobile-ai-btn" onClick={onAIAssistantClick}>
              <Sparkles size={15} strokeWidth={2.25} />
              <span>AI Assistant</span>
            </button>

            <div className="nav-mobile-footer">
              <div className="nav-mobile-user">
                <span className="nav-user-avatar" aria-hidden="true">
                  <UserIcon size={14} strokeWidth={2.25} />
                </span>
                <span className="nav-user-text">{userName}</span>
              </div>
              <button className="nav-mobile-signout" onClick={onLogout}>
                <LogOut size={15} strokeWidth={2.25} />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="nav-divider" aria-hidden="true" />
    </nav>
  )
}