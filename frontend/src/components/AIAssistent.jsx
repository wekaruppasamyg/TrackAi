import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore, useLocationStore } from '../store'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// ── Language config ───────────────────────────────────────────────────────────
const LANGUAGES = [
  { code:'en', label:'English',  flag:'🇬🇧', placeholder:'Ask me anything…' },
  { code:'ta', label:'தமிழ்',    flag:'🇮🇳', placeholder:'என்னிடம் கேளுங்கள்…' },
  { code:'hi', label:'हिंदी',    flag:'🇮🇳', placeholder:'मुझसे कुछ भी पूछें…' },
  { code:'te', label:'తెలుగు',   flag:'🇮🇳', placeholder:'నన్ను ఏదైనా అడగండి…' },
  { code:'ml', label:'മലയാളം',  flag:'🇮🇳', placeholder:'എന്നോട് എന്തും ചോദിക്കൂ…' },
]
const LANG_PROMPTS = {
  en:'Respond in English. Be friendly and warm.',
  ta:'தமிழில் பதில் சொல்லுங்கள்.',
  hi:'हिंदी में जवाब दें।',
  te:'తెలుగులో సమాధానం ఇవ్వండి.',
  ml:'മലയാളത്തിൽ മറുപടി പറയൂ.',
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function md(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g,  '<strong style="color:#c4b5fd">$1</strong>')
    .replace(/\*(.*?)\*/g,      '<em>$1</em>')
    .replace(/`([^`]+)`/g,      '<code style="background:rgba(255,255,255,0.1);padding:1px 6px;border-radius:4px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/^#{1,3} (.+)$/gm, '<div style="font-weight:800;font-size:14px;color:#a5b4fc;margin:8px 0 4px">$1</div>')
    .replace(/^[•\-\*] (.+)$/gm,'<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm,'<li style="margin:3px 0;padding-left:4px"><span style="color:#a5b4fc;font-weight:700">$1.</span> $2</li>')
    .replace(/(<li.*?<\/li>\n?)+/gs, m => `<ul style="margin:6px 0 6px 12px;padding:0;list-style:none">${m}</ul>`)
    // Coords → map link
    .replace(/(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/g,
      (_,lat,lon)=>`<a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" style="color:#818cf8;font-size:11px;text-decoration:none;border-bottom:1px dotted #818cf8">${lat},${lon} 🗺</a>`)
    .replace(/\n/g,'<br/>')
}

// ── Parse action block from AI reply ─────────────────────────────────────────
function parseAction(text) {
  const m = text.match(/```action\s*([\s\S]*?)```/)
  if (!m) return null
  try { return JSON.parse(m[1].trim()) } catch { return null }
}
function stripAction(text) {
  return text.replace(/```action\s*[\s\S]*?```/g, '').trim()
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function Dots() {
  return (
    <div style={{display:'flex',gap:5,alignItems:'center',padding:'6px 2px'}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{
          width:8,height:8,borderRadius:'50%',
          background:'linear-gradient(135deg,#6366f1,#a78bfa)',
          animation:`ai-bounce 1.4s ease-in-out ${i*0.16}s infinite`,
        }}/>
      ))}
    </div>
  )
}

// ── Alert banner ──────────────────────────────────────────────────────────────
function AlertBanner({ alerts, onDismiss }) {
  if (!alerts.length) return null
  return (
    <div style={{
      margin:'0 12px 8px',
      background:'rgba(245,158,11,0.08)',
      border:'1px solid rgba(245,158,11,0.3)',
      borderRadius:10, overflow:'hidden',
    }}>
      {alerts.map((a,i)=>(
        <div key={i} style={{
          padding:'7px 12px', fontSize:12, color:'#fcd34d',
          borderBottom: i<alerts.length-1 ? '1px solid rgba(245,158,11,0.15)' : 'none',
          display:'flex', alignItems:'flex-start', gap:6,
        }}>
          <span style={{flexShrink:0}}>🔔</span>
 <span style={{ flex: 1, lineHeight: 1.5 }}>
  {typeof a === "string"
    ? a
    : `${a.icon || "🔔"} ${a.user || "Unknown"} - ${a.message || ""}`}
</span>
        </div>
      ))}
      <button onClick={onDismiss} style={{
        width:'100%',padding:'5px',background:'transparent',border:'none',
        color:'rgba(245,158,11,0.5)',cursor:'pointer',fontSize:11,
      }}>Dismiss alerts</button>
    </div>
  )
}

// ── Action card (command result) ──────────────────────────────────────────────
function ActionCard({ action, onExecute }) {
  const labels = {
    open_map:       { icon:'🗺', label:'Open Map',        color:'#6366f1' },
    start_tracking: { icon:'▶',  label:'Start Tracking',  color:'#22c55e' },
    stop_tracking:  { icon:'⏹',  label:'Stop Tracking',   color:'#ef4444' },
    send_sos:       { icon:'🆘', label:'Send SOS',        color:'#ef4444' },
    navigate:       { icon:'🧭', label:'Open Navigation', color:'#6366f1' },
    open_history:   { icon:'⏱', label:'Open History',    color:'#a78bfa' },
    open_geofences: { icon:'◉',  label:'Open Geofences',  color:'#22c55e' },
  }
  const info = labels[action.action] || { icon:'⚡',label:action.action,color:'#6366f1' }
  return (
    <div style={{
      margin:'6px 0 2px',
      background:`rgba(${info.color==='#22c55e'?'34,197,94':'99,102,241'},0.08)`,
      border:`1px solid ${info.color}40`,
      borderRadius:10, padding:'10px 12px',
      display:'flex', alignItems:'center', gap:10,
    }}>
      <span style={{fontSize:20}}>{info.icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:2}}>AI wants to execute:</div>
        <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>
          {info.label}{action.user ? ` for ${action.user}` : ''}{action.destination ? ` → ${action.destination}` : ''}
        </div>
      </div>
      <button onClick={() => onExecute(action)} style={{
        padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
        background:info.color, color: info.color==='#22c55e'?'#000':'#fff',
        fontSize:12, fontWeight:700, flexShrink:0,
      }}>Run ➤</button>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, isNew, onAction }) {
  const isUser   = msg.role==='user'
  const isSystem = msg.role==='system'
  if (isSystem) return (
    <div style={{textAlign:'center',margin:'6px 0'}}>
      <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',background:'rgba(255,255,255,0.05)',padding:'3px 10px',borderRadius:20}}>{msg.content}</span>
    </div>
  )
  const action      = !isUser ? parseAction(msg.content) : null
  const displayText = !isUser ? stripAction(msg.content) : msg.content

  return (
    <div className={isNew?'ai-msg-enter':''} style={{
      display:'flex', justifyContent:isUser?'flex-end':'flex-start',
      marginBottom:14, alignItems:'flex-end', gap:8,
    }}>
      {!isUser && (
        <div style={{
          width:34,height:34,borderRadius:'50%',flexShrink:0,
          background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:17,boxShadow:'0 2px 12px rgba(99,102,241,0.5)',
          border:'2px solid rgba(255,255,255,0.1)',
        }}>🤖</div>
      )}
      <div style={{maxWidth:'78%',display:'flex',flexDirection:'column',gap:4,alignItems:isUser?'flex-end':'flex-start'}}>
        <div
          className={!isUser?'ai-bubble':''}
          style={{
            padding:'11px 15px',
            borderRadius:isUser?'20px 20px 5px 20px':'5px 20px 20px 20px',
            background:isUser?'linear-gradient(135deg,#6366f1,#8b5cf6)':'rgba(255,255,255,0.07)',
            color:'#fff', fontSize:13.5, lineHeight:1.65,
            border:isUser?'none':'1px solid rgba(255,255,255,0.1)',
            boxShadow:isUser?'0 4px 16px rgba(99,102,241,0.35)':'0 2px 8px rgba(0,0,0,0.2)',
            wordBreak:'break-word',
          }}
          dangerouslySetInnerHTML={!isUser?{__html:md(displayText)}:undefined}
        >
          {isUser?displayText:undefined}
        </div>
        {action && <ActionCard action={action} onExecute={onAction}/>}
        <div style={{fontSize:10,color:'rgba(255,255,255,0.25)',padding:'0 4px'}}>{msg.time||''}</div>
      </div>
      {isUser && (
        <div style={{
          width:34,height:34,borderRadius:'50%',flexShrink:0,
          background:'rgba(255,255,255,0.08)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:15,border:'1px solid rgba(255,255,255,0.12)',
        }}>👤</div>
      )}
    </div>
  )
}

// ── Language picker ───────────────────────────────────────────────────────────
function LangPicker({ current, onChange, onClose }) {
  return (
    <div style={{
      position:'absolute',top:60,right:12,zIndex:200,
      background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.12)',
      borderRadius:14,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
      animation:'ai-pop 0.2s ease-out',
    }}>
      {LANGUAGES.map(l=>(
        <button key={l.code} onClick={()=>{onChange(l.code);onClose()}} style={{
          width:'100%',padding:'10px 16px',display:'flex',alignItems:'center',gap:10,
          background:current===l.code?'rgba(99,102,241,0.2)':'transparent',
          border:'none',cursor:'pointer',color:'#fff',
          borderBottom:'1px solid rgba(255,255,255,0.05)',
          fontSize:13,textAlign:'left',transition:'background 0.15s',
        }}>
          <span style={{fontSize:18}}>{l.flag}</span>
          <span style={{fontWeight:current===l.code?700:400}}>{l.label}</span>
          {current===l.code && <span style={{marginLeft:'auto',color:'#a78bfa',fontSize:16}}>✓</span>}
        </button>
      ))}
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function AIAssistant({ onTabChange, onCommand, onVoiceSearch }) {
  const user  = useAuthStore(s=>s.user)
  const token = useAuthStore(s=>s.token)
  const isTracking    = useLocationStore(s=>s.isTracking)

  const [open,        setOpen]       = useState(false)
  const [messages,    setMessages]   = useState([])
  const [input,       setInput]      = useState('')
  const [loading,     setLoading]    = useState(false)
  const [suggestions, setSugg]       = useState([])
  const [listening,   setListening]  = useState(false)
  const [error,       setError]      = useState('')
  const [lang,        setLang]       = useState('en')
  const [showLang,    setShowLang]   = useState(false)
  const [unread,      setUnread]     = useState(0)
  const [newIdx,      setNewIdx]     = useState(null)
  const [alerts,      setAlerts]     = useState([])

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const recognRef = useRef(null)
  const voiceResultRef = useRef(false)
  const panelRef  = useRef(null)

  const currentLang = LANGUAGES.find(l=>l.code===lang)||LANGUAGES[0]
  const nowStr = () => new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
  const speak = useCallback((text) => {
    if (!text || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    const lm = { en:'en-US', ta:'ta-IN', hi:'hi-IN', te:'te-IN', ml:'ml-IN' }
    utt.lang = lm[lang] || 'en-US'
    utt.rate = 1.0
    window.speechSynthesis.speak(utt)
  }, [lang])

  const normalizeVoiceText = useCallback((text) => {
    return (text || '').toLowerCase().replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim()
  }, [])

  // Scroll to bottom
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages,loading])

  // On open
  useEffect(()=>{
    if (open) {
      setUnread(0)
      setTimeout(()=>inputRef.current?.focus(),150)
      if (messages.length===0) { showWelcome(); loadSugg() }
      fetchAlerts()
    }
  },[open])

  // Proactive alerts poll every 60s while panel open
  useEffect(()=>{
    if (!open) return
    const id = setInterval(fetchAlerts, 60_000)
    return ()=>clearInterval(id)
  },[open,token])

  // Outside click closes lang picker
  useEffect(()=>{
    if (!showLang) return
    const h=(e)=>{ if (!panelRef.current?.contains(e.target)) setShowLang(false) }
    document.addEventListener('mousedown',h)
    return ()=>document.removeEventListener('mousedown',h)
  },[showLang])

  const fetchAlerts = useCallback(async()=>{
    if (!token) return
    try {
      const r = await fetch(`${API_BASE}/ai/alerts`,{headers:{Authorization:`Bearer ${token}`}})
      if (r.ok) { const d=await r.json(); setAlerts(d.alerts||[]) }
    } catch {}
  },[token])

  const showWelcome = useCallback(()=>{
    const g = {
      en: user?.is_admin
        ? `👋 Hey Admin **${user?.username}**! I'm your TrackAI AI with full system access.\n\nI can:\n• 📍 Show any user's live location with address\n• ⚠️ Alert you about anomalies & stationary users\n• 📊 Generate detailed reports\n• 🔍 Detect travel patterns\n\nWhat would you like to know?`
        : `👋 Hi **${user?.username}**! I'm your smart TrackAI assistant 😊\n\nI can:\n• 📍 Tell you exactly where you are (with real address!)\n• 📊 Summarize your trips & patterns\n• 🧭 Start navigation from chat\n• 📄 Download your location report\n\nWhat would you like?`,
      ta:`👋 வணக்கம் **${user?.username}**! நான் TrackAI AI 😊\n📍 உங்கள் இருப்பிடம் | 📊 பயண புள்ளிவிவரங்கள் | 🧭 வழிசெலுத்தல் | 📄 அறிக்கை\nகேட்கவும்!`,
      hi:`👋 नमस्ते **${user?.username}**! मैं TrackAI AI हूँ 😊\n📍 आपकी लोकेशन | 📊 यात्रा आँकड़े | 🧭 नेविगेशन | 📄 रिपोर्ट\nकुछ भी पूछें!`,
      te:`👋 నమస్కారం **${user?.username}**! TrackAI AI 😊\n📍 స్థానం | 📊 ప్రయాణ గణాంకాలు | 🧭 నావిగేషన్ | 📄 నివేదిక\nఏదైనా అడగండి!`,
      ml:`👋 നമസ്കാരം **${user?.username}**! TrackAI AI 😊\n📍 ലൊക്കേഷൻ | 📊 യാത്രാ കണക്കുകൾ | 🧭 നാവിഗേഷൻ | 📄 റിപ്പോർട്ട്\nചോദിക്കൂ!`,
    }
    setMessages([{role:'assistant',content:g[lang]||g.en,time:nowStr()}])
  },[lang,user])

  const loadSugg = useCallback(async()=>{
    try {
      const r=await fetch(`${API_BASE}/ai/suggestions`,{headers:{Authorization:`Bearer ${token}`}})
      if (r.ok){ const d=await r.json(); setSugg(d.suggestions||[]) }
    } catch {}
  },[token])

  const addSystem = useCallback((txt) => {
    setMessages(p => [...p, { role: 'system', content: txt, time: nowStr() }])
  }, [])

  const detectVoiceCommand = useCallback((rawText) => {
    const text = normalizeVoiceText(rawText)
    if (!text) return null

    if (/^(start|begin|resume)( live)? tracking$/.test(text) || text.includes('start tracking')) {
      return { type: 'action', action: 'start_tracking' }
    }

    if (/^(stop|pause)( live)? tracking$/.test(text) || text.includes('stop tracking')) {
      return { type: 'action', action: 'stop_tracking' }
    }

    if (text.includes('send sos') || text.includes('sos now') || text.includes('emergency')) {
      return { type: 'action', action: 'send_sos' }
    }

    if (/where am i|current location|where is me/.test(text)) {
      return { type: 'chat', text: 'Where am I right now?' }
    }

    const navMatch = text.match(/^(?:navigate|go to|take me to) (.+)$/)
    if (navMatch) {
      return { type: 'navigation', destination: navMatch[1].trim(), autoStart: true }
    }

    if (text === 'navigate home' || text.includes('go home')) {
      return { type: 'navigation', destination: 'home', autoStart: true }
    }

    if (/open navigation|start navigation/.test(text)) {
      return { type: 'tab', tab: 'navigate', announcement: 'Opening navigation.' }
    }

    if (/open map|show map/.test(text)) {
      return { type: 'tab', tab: 'map', announcement: 'Opening the map.' }
    }

    if (user?.is_admin) {
      if (/open map dashboard|show live users|open admin dashboard/.test(text)) {
        return { type: 'action', action: 'open_admin', announcement: 'Opening the admin dashboard.' }
      }

      if (/show geofence alerts|open ai insights|show analytics/.test(text)) {
        return { type: 'action', action: 'open_admin', announcement: 'Opening admin insights.' }
      }

      const userMatch = text.match(/show user (.+)$/)
      if (userMatch) {
        return { type: 'action', action: 'focus_user', user: userMatch[1].trim(), announcement: `Looking for ${userMatch[1].trim()}.` }
      }

      if (text.includes("download today's report") || text.includes('download today report')) {
        return { type: 'report', announcement: "Opening today's report." }
      }
    }

    return null
  }, [user?.is_admin, normalizeVoiceText])

  const handleVoiceTranscript = useCallback(async (text) => {
    const command = detectVoiceCommand(text)
    if (!command) {
      await sendMessage(text)
      return
    }

    if (command.type === 'chat') {
      await sendMessage(command.text)
      return
    }

    if (command.type === 'navigation') {
      onVoiceSearch?.({ destination: command.destination, autoStart: command.autoStart })
      const msg = command.announcement || `Searching for ${command.destination}`
      addSystem(msg)
      speak(msg)
      setOpen(false)
      return
    }

    if (command.type === 'report') {
      window.open(`${API_BASE}/ai/report/pdf?days=7&token=${encodeURIComponent(token||'')}`, '_blank')
      const msg = command.announcement || 'Opening report.'
      addSystem(msg)
      speak(msg)
      return
    }

    if (command.type === 'tab') {
      onTabChange?.(command.tab)
      setOpen(false)
      const msg = command.announcement || `Opened ${command.tab}`
      addSystem(msg)
      speak(msg)
      return
    }

    if (command.type === 'action') {
      if (command.action === 'open_admin') {
        onTabChange?.('admin')
        onCommand?.({ type: 'open_admin' })
        setOpen(false)
        const msg = command.announcement || 'Opening admin dashboard.'
        addSystem(msg)
        speak(msg)
        return
      }

      if (command.action === 'focus_user') {
        onTabChange?.('admin')
        onCommand?.({ type: 'focus_user', user: command.user })
        setOpen(false)
        const msg = command.announcement || `Focusing on ${command.user}`
        addSystem(msg)
        speak(msg)
        return
      }

      executeAction(command)
      speak(command.announcement || 'Done.')
      return
    }
  }, [addSystem, detectVoiceCommand, executeAction, onCommand, onTabChange, onVoiceSearch, sendMessage, speak, token])

  // ── Feature 3: Execute NL Commands ──────────────────────────────────────────
  function executeAction(action) {
    switch (action.action) {
      case 'open_map':
        onTabChange?.('map')
        setOpen(false)
        addSystem(`Opened Map${action.user ? ` for ${action.user}` : ''}`)
        break
      case 'start_tracking':
        onTabChange?.('tracking')
        onCommand?.({ type: 'start_tracking' })
        setOpen(false)
        addSystem('Opened Tracking tab — tap Start')
        break
      case 'stop_tracking':
        onTabChange?.('tracking')
        onCommand?.({ type: 'stop_tracking' })
        setOpen(false)
        addSystem('Opened Tracking tab — tap Stop')
        break
      case 'send_sos':
        onCommand?.({ type: 'send_sos' })
        if (window.confirm('⚠️ Send SOS alert to admins?')) addSystem('🆘 SOS sent!')
        break
      case 'navigate':
        onTabChange?.('navigate')
        setOpen(false)
        addSystem(`Opened Navigation${action.destination?` → ${action.destination}`:''}`)
        break
      case 'open_history':
        onTabChange?.('history')
        setOpen(false)
        addSystem('Opened Route History')
        break
      case 'open_geofences':
        onTabChange?.('geofence')
        setOpen(false)
        addSystem('Opened Geofences')
        break
      case 'open_admin':
        onTabChange?.('admin')
        setOpen(false)
        addSystem(action.announcement || 'Opened Admin Dashboard')
        break
      case 'focus_user':
        onTabChange?.('admin')
        onCommand?.({ type: 'focus_user', user: action.user })
        setOpen(false)
        addSystem(action.announcement || `Focusing on ${action.user}`)
        break
      default:
        addSystem(`Unknown action: ${action.action}`)
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    const content=(text||input).trim()
    if (!content||loading) return

    // Local shortcut: "download report"
    if (/download|report|pdf/i.test(content)) {
      const url = `${API_BASE}/ai/report/pdf?days=7`
      const a   = document.createElement('a')
      a.href = url
      a.setAttribute('download','trackai_report.pdf')
      // Attach auth via hidden iframe trick — or just open in new tab
      window.open(`${url}&token=${encodeURIComponent(token||'')}`, '_blank')
      setMessages(p=>[...p,
        {role:'user',content,time:nowStr()},
        {role:'assistant',content:'📄 Opening your report download… Check your downloads folder.',time:nowStr()},
      ])
      setInput('')
      return
    }

    const userMsg={role:'user',content,time:nowStr()}
    const newMsgs=[...messages,userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)
    setError('')
    setSugg([])

    try {
      const msgsToSend=newMsgs.map((m,i)=>({
        role:m.role==='assistant'?'assistant':'user',
        content:i===newMsgs.length-1&&m.role==='user'
          ?`[${LANG_PROMPTS[lang]}]\n${m.content}`
          :m.content,
      }))

      const res=await fetch(`${API_BASE}/ai/chat`,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({messages:msgsToSend}),
      })
      if (!res.ok){ const e=await res.json(); throw new Error(e.detail||'Failed') }
      const data=await res.json()
      const idx=newMsgs.length
      setNewIdx(idx)
      setMessages(p=>[...p,{role:'assistant',content:data.reply,time:nowStr()}])
      setTimeout(()=>setNewIdx(null),500)
      if (!open) setUnread(u=>u+1)

      // Voice output
      if ((listening || voiceResultRef.current) && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const plain=data.reply.replace(/<[^>]*>/g,'').replace(/[•*`#]/g,'').trim()
        const utt=new SpeechSynthesisUtterance(plain)
        const lm={en:'en-US',ta:'ta-IN',hi:'hi-IN',te:'te-IN',ml:'ml-IN'}
        utt.lang=lm[lang]||'en-US'; utt.rate=1.0
        window.speechSynthesis.speak(utt)
        voiceResultRef.current = false
      }

      // Follow-up suggestions
      setTimeout(()=>{
        const fu={
          en:['Tell me more','Show on map','Any anomalies?','Download report'],
          ta:['மேலும் சொல்','வரைபடத்தில் காட்டு','ஏதாவது அசாதாரணம்?'],
          hi:['और बताएं','मैप में दिखाएं','कोई असामान्य गतिविधि?'],
          te:['మరింత చెప్పండి','మ్యాప్‌లో చూపించు','ఏదైనా అసాధారణమా?'],
          ml:['കൂടുതൽ','മാപ്പിൽ കാണിക്കൂ','എന്തെങ്കിലും അസ്വാഭാവികം?'],
        }
        setSugg(fu[lang]||fu.en)
      },700)

    } catch(e){
      setError(e.message)
      setMessages(p=>[...p,{
        role:'assistant',
        content:lang==='ta'?'மன்னிக்கவும், பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.'
              :lang==='hi'?'माफ करें, कनेक्शन में समस्या। कृपया पुनः प्रयास करें।'
              :'Sorry, something went wrong. Please try again.',
        time:nowStr(),
      }])
    } finally { setLoading(false) }
  }

  const handleKey=(e)=>{ if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()} }

  // Voice input
  const toggleVoice=async()=>{
    if (!window.isSecureContext) { setError('Microphone requires HTTPS or localhost.'); return }
    if (!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){setError('Voice recognition is not supported in this browser. Use Chrome or Edge.');return}
    if (listening){recognRef.current?.stop();setListening(false);return}
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
      setError(denied ? 'Microphone permission denied. Allow microphone access in the browser address bar.' : (err?.message || 'No microphone was found.'))
      return
    }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition
    const r=new SR(); recognRef.current=r
    const lm={en:'en-US',ta:'ta-IN',hi:'hi-IN',te:'te-IN',ml:'ml-IN'}
    r.lang=lm[lang]||'en-US'; r.continuous=false; r.interimResults=false
    r.onstart=()=>setListening(true)
    r.onend=()=>{setListening(false);recognRef.current=null}
    r.onerror=(event)=>{
      const messages={
        'no-speech':'I could not hear anything. Tap the microphone and speak again.',
        'audio-capture':'No working microphone was found.',
        'not-allowed':'Microphone permission denied. Allow it in the browser address bar.',
        'service-not-allowed':'Browser speech recognition is blocked.',
        'network':'Speech recognition needs an internet connection.',
        'language-not-supported':'The selected voice language is not supported by this browser.',
        'aborted':'Voice listening was stopped.',
      }
      setListening(false)
      if (event.error !== 'aborted') setError(messages[event.error] || `Voice recognition failed (${event.error || 'unknown error'}).`)
    }
    r.onresult=(e)=>{
      const result=e.results[e.resultIndex || 0]?.[0]
      const t=result?.transcript?.trim()
      if (!t) { setError('No speech was recognized. Please try again.'); return }
      voiceResultRef.current=true
      setInput(t)
      setTimeout(()=>handleVoiceTranscript(t),100)
    }
    try { r.start() } catch (err) { setListening(false); setError(err.message || 'Unable to start voice recognition.') }
  }

  const clearChat=()=>{ setMessages([]); setSugg([]); setTimeout(()=>{showWelcome();loadSugg()},50) }
  const handleLangChange=(code)=>{ setLang(code); setMessages([]); setSugg([]); setTimeout(()=>{showWelcome();loadSugg()},50) }

  if (!user) return null

  const PW = Math.min(420, (typeof window!=='undefined'?window.innerWidth:420)-32)
  const PH = Math.min(630, (typeof window!=='undefined'?window.innerHeight:630)-130)

  return (
    <>
      <style>{`
        @keyframes ai-bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-8px);opacity:1}}
        @keyframes ai-fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ai-pop{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
        @keyframes ai-glow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.3)}50%{box-shadow:0 0 40px rgba(99,102,241,0.6)}}
        @keyframes ai-slide-up{from{opacity:0;transform:translateY(30px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes ai-pulse-dot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.6}}
        .ai-msg-enter{animation:ai-fade-in 0.3s ease-out forwards}
        .ai-scrollbar::-webkit-scrollbar{width:4px}
        .ai-scrollbar::-webkit-scrollbar-track{background:transparent}
        .ai-scrollbar::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:4px}
        .ai-btn-hover:hover{transform:scale(1.05);transition:transform 0.15s}
        .ai-suggestion:hover{background:rgba(99,102,241,0.2)!important;transform:translateY(-1px);transition:all 0.15s}
        .ai-send:hover:not(:disabled){transform:scale(1.05);box-shadow:0 4px 20px rgba(99,102,241,0.5)!important}
        .ai-input:focus{border-color:rgba(99,102,241,0.5)!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)!important}
        .ai-bubble ul{margin:4px 0 4px 12px;padding:0}
        .ai-bubble li{margin:3px 0}
        .ai-bubble strong{color:#c4b5fd}
        .ai-bubble a{color:#818cf8}
        .ai-bubble a:hover{text-decoration:underline}
        .ai-bubble code{font-family:monospace}
      `}</style>

      {/* Floating button */}
      <button onClick={()=>setOpen(o=>!o)} style={{
        position:'fixed',bottom:90,right:24,zIndex:8000,
        width:60,height:60,borderRadius:'50%',
        background:open?'#1a1a2e':'linear-gradient(135deg,#6366f1,#8b5cf6)',
        border:open?'2px solid rgba(99,102,241,0.5)':'none',
        cursor:'pointer',
        boxShadow:open?'0 4px 20px rgba(99,102,241,0.3)':'0 4px 24px rgba(99,102,241,0.6)',
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:26,transition:'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        animation:open?'none':'ai-glow 3s ease-in-out infinite',
      }}>{open?'✕':'🤖'}</button>

      {/* Unread */}
      {!open&&unread>0&&(
        <div style={{position:'fixed',bottom:140,right:20,zIndex:8001,width:20,height:20,borderRadius:'50%',background:'#ef4444',border:'2px solid #0a0a0f',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:'#fff'}}>{unread}</div>
      )}
      {/* Online dot */}
      {!open&&(
        <div style={{position:'fixed',bottom:88,right:22,zIndex:8001,width:14,height:14,borderRadius:'50%',background:'#22c55e',border:'2px solid #0a0a0f',animation:'ai-pulse-dot 2s ease-in-out infinite',pointerEvents:'none'}}/>
      )}
      {/* Alert badge on button */}
      {!open&&alerts.length>0&&(
        <div style={{position:'fixed',bottom:142,right:18,zIndex:8001,background:'#f59e0b',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:'#000',border:'2px solid #0a0a0f'}}>!</div>
      )}

      {/* Chat panel */}
      {open&&(
        <div ref={panelRef} style={{
          position:'fixed',bottom:164,right:24,zIndex:7999,
          width:PW,height:PH,
          background:'linear-gradient(180deg,#0f0f1a 0%,#12121f 100%)',
          border:'1px solid rgba(99,102,241,0.2)',borderRadius:24,
          boxShadow:'0 32px 80px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.05) inset',
          display:'flex',flexDirection:'column',overflow:'hidden',
          animation:'ai-slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* Header */}
          <div style={{
            padding:'14px 16px',
            background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08))',
            borderBottom:'1px solid rgba(255,255,255,0.07)',
            display:'flex',alignItems:'center',gap:10,position:'relative',flexShrink:0,
          }}>
            <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:'0 2px 12px rgba(99,102,241,0.5)',border:'2px solid rgba(255,255,255,0.15)',flexShrink:0}}>🤖</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:15,color:'#fff',letterSpacing:'-0.3px'}}>TrackAI Assistant</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',animation:'ai-pulse-dot 2s infinite',flexShrink:0}}/>
                <span>{user.is_admin?'🔑 Admin':'👤 User'} · {currentLang.flag} {currentLang.label}</span>
                {alerts.length>0&&<span style={{marginLeft:4,background:'rgba(245,158,11,0.2)',border:'1px solid rgba(245,158,11,0.4)',color:'#fcd34d',fontSize:10,padding:'1px 6px',borderRadius:10}}>{alerts.length} alert{alerts.length>1?'s':''}</span>}
              </div>
            </div>
            <button onClick={()=>setShowLang(s=>!s)} className="ai-btn-hover" style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:16,flexShrink:0}}>{currentLang.flag}</button>
            <button onClick={()=>{ window.open(`${API_BASE}/ai/report/pdf?days=7`,`_blank`) }} className="ai-btn-hover" title="Download report" style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:15,flexShrink:0}}>📄</button>
            <button onClick={clearChat} className="ai-btn-hover" title="Clear" style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:15,flexShrink:0}}>🗑</button>
            <button onClick={()=>setOpen(false)} className="ai-btn-hover" style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:18,flexShrink:0}}>×</button>
            {showLang&&<LangPicker current={lang} onChange={handleLangChange} onClose={()=>setShowLang(false)}/>}
          </div>

          {/* Alerts */}
          {alerts.length>0&&(
            <AlertBanner alerts={alerts} onDismiss={()=>setAlerts([])}/>
          )}

          {/* Messages */}
          <div className="ai-scrollbar" style={{flex:1,overflowY:'auto',padding:'16px 14px',display:'flex',flexDirection:'column'}}>
            {messages.map((msg,i)=>(
              <Bubble key={i} msg={msg} isNew={i===newIdx} onAction={executeAction}/>
            ))}
            {loading&&(
              <div style={{display:'flex',alignItems:'flex-end',gap:8,marginBottom:12}} className="ai-msg-enter">
                <div style={{width:34,height:34,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>🤖</div>
                <div style={{padding:'10px 16px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'5px 20px 20px 20px'}}><Dots/></div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Suggestions */}
          {suggestions.length>0&&!loading&&(
            <div style={{padding:'8px 12px 4px',borderTop:'1px solid rgba(255,255,255,0.05)',display:'flex',gap:6,flexWrap:'wrap',flexShrink:0}}>
              {suggestions.slice(0,4).map((s,i)=>(
                <button key={i} onClick={()=>sendMessage(s)} className="ai-suggestion" style={{
                  padding:'5px 11px',borderRadius:20,fontSize:11.5,cursor:'pointer',
                  background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.25)',
                  color:'#a5b4fc',whiteSpace:'nowrap',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',fontFamily:'inherit',
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Error */}
          {error&&(
            <div style={{margin:'0 12px 6px',padding:'8px 12px',borderRadius:10,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#fca5a5',fontSize:12,display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
              <span>⚠️</span><span style={{flex:1}}>{error}</span>
              <button onClick={()=>setError('')} style={{background:'none',border:'none',color:'#fca5a5',cursor:'pointer',fontSize:16}}>×</button>
            </div>
          )}

          {/* Input */}
          <div style={{padding:'10px 12px 14px',borderTop:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.2)',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
            <textarea
              ref={inputRef} value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={currentLang.placeholder}
              rows={1}
              className="ai-input ai-scrollbar"
              style={{
                flex:1,padding:'10px 13px',
                background:'rgba(255,255,255,0.06)',
                border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:14,color:'#fff',fontSize:13.5,
                outline:'none',resize:'none',lineHeight:1.5,
                maxHeight:110,overflowY:'auto',
                fontFamily:'inherit',transition:'border-color 0.2s,box-shadow 0.2s',
              }}
              onInput={e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,110)+'px' }}
            />
            <button onClick={toggleVoice} className="ai-btn-hover" title={listening?'Stop':'Voice'} style={{
              width:42,height:42,borderRadius:12,flexShrink:0,
              background:listening?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.06)',
              border:`1px solid ${listening?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.1)'}`,
              color:listening?'#ef4444':'rgba(255,255,255,0.5)',
              cursor:'pointer',fontSize:18,
              animation:listening?'ai-pulse-dot 1s infinite':'none',
            }}>🎤</button>
            <button onClick={()=>sendMessage()} disabled={!input.trim()||loading} className="ai-send" style={{
              width:42,height:42,borderRadius:12,flexShrink:0,
              background:input.trim()&&!loading?'linear-gradient(135deg,#6366f1,#8b5cf6)':'rgba(255,255,255,0.04)',
              border:'none',cursor:input.trim()&&!loading?'pointer':'not-allowed',
              color:'#fff',fontSize:20,opacity:input.trim()&&!loading?1:0.3,
              transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',
            }}>➤</button>
          </div>
        </div>
      )}
    </>
  )
}
