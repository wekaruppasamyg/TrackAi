"""
app/routes/ai_assistant.py
TrackAI Advanced AI Assistant - Groq (Llama 3.3-70B)

Features:
  Level 1: Reverse geocoding, Natural language commands, Proactive alerts
  Level 2: Pattern detection, Trip summaries, Anomaly detection
  Level 3: Predictive AI, Multi-turn memory, Report generation
"""

import logging, math, os, json, re, urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from groq import Groq

from app.database import get_db
from app.routes.users import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
groq_client  = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

SYSTEM_PROMPT = """You are TrackAI Assistant - an advanced intelligent GPS tracking AI with FULL real-time data access.

CAPABILITIES:
- You know every user's exact location, travel history, speed, patterns
- You detect anomalies, predict routes, generate reports
- You understand natural language commands
- You speak any language the user uses

RULES:
1. Always use the REAL DATA provided - never say "I don't have access"
2. For "where am I?" → give exact place name + coords + time
3. For "who is online?" → list live users with locations
4. Detect patterns, flag anomalies, generate trip summaries
5. Be warm, friendly, conversational like a helpful friend
6. ALWAYS reply in the SAME language as the user

ACTIONS - append to reply when user gives a command:
"start tracking"     → [ACTION:START_TRACKING]
"stop tracking"      → [ACTION:STOP_TRACKING]
"show map / open map"→ [ACTION:OPEN_MAP]
"send sos"           → [ACTION:SEND_SOS]
"go to history"      → [ACTION:NAVIGATE:history]
"go to geofences"    → [ACTION:NAVIGATE:geofence]
"go to navigate"     → [ACTION:NAVIGATE:navigate]
"show [user] on map" → [ACTION:FOCUS_USER:username]
"""

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    lat1,lon1,lat2,lon2 = map(math.radians,[lat1,lon1,lat2,lon2])
    dlat,dlon = lat2-lat1, lon2-lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def calc_dist(locs):
    return round(sum(haversine(locs[i].latitude,locs[i].longitude,
                               locs[i+1].latitude,locs[i+1].longitude)
                     for i in range(len(locs)-1)), 2)

def ts_utc(ts):
    if ts is None: return None
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts

def ago(ts, now):
    if not ts: return "unknown"
    diff = int((now - ts_utc(ts)).total_seconds())
    if diff < 60:    return f"{diff}s ago"
    if diff < 3600:  return f"{diff//60}m ago"
    if diff < 86400: return f"{diff//3600}h {(diff%3600)//60}m ago"
    return f"{diff//86400}d ago"

def reverse_geocode(lat, lon):
    try:
        url = (f"https://nominatim.openstreetmap.org/reverse"
               f"?format=json&lat={lat}&lon={lon}&zoom=16&addressdetails=1")
        req = urllib.request.Request(url, headers={"User-Agent":"TrackAI/2.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            d = json.loads(resp.read())
        addr = d.get("address", {})
        parts = [
            addr.get("road") or addr.get("pedestrian") or addr.get("neighbourhood"),
            addr.get("suburb") or addr.get("quarter"),
            addr.get("city") or addr.get("town") or addr.get("village"),
            addr.get("state"),
        ]
        return ", ".join(p for p in parts if p) or d.get("display_name", f"{lat:.4f},{lon:.4f}")
    except:
        return f"{lat:.5f}, {lon:.5f}"

def detect_trips(locs, gap_minutes=15):
    if len(locs) < 2: return []
    trips, current = [], [locs[0]]
    for i in range(1, len(locs)):
        prev, curr = locs[i-1], locs[i]
        gap = (ts_utc(curr.timestamp) - ts_utc(prev.timestamp)).total_seconds() / 60
        if gap > gap_minutes:
            if len(current) >= 2: trips.append(current)
            current = [curr]
        else:
            current.append(curr)
    if len(current) >= 2: trips.append(current)
    result = []
    for t in trips:
        st = ts_utc(t[0].timestamp); et = ts_utc(t[-1].timestamp)
        d  = calc_dist(t)
        if d < 0.05: continue
        result.append({
            "start_time":   st.strftime("%H:%M"),
            "end_time":     et.strftime("%H:%M"),
            "duration_min": int((et - st).total_seconds() / 60),
            "distance_km":  d,
            "start_lat":    t[0].latitude, "start_lon": t[0].longitude,
            "end_lat":      t[-1].latitude,"end_lon":  t[-1].longitude,
        })
    return result

def detect_patterns(locs):
    if len(locs) < 10: return {}
    hour_counts  = defaultdict(int)
    freq_locs    = defaultdict(int)
    day_dist     = defaultdict(float)
    prev = None
    for loc in locs:
        ts = ts_utc(loc.timestamp)
        hour_counts[(ts.weekday(), ts.hour)] += 1
        freq_locs[(round(loc.latitude,2), round(loc.longitude,2))] += 1
        if prev:
            pts = ts_utc(prev.timestamp)
            if ts.date() == pts.date():
                day_dist[ts.date()] += haversine(prev.latitude,prev.longitude,loc.latitude,loc.longitude)
        prev = loc
    wkd = {(d,h):c for (d,h),c in hour_counts.items() if d<5}
    top = max(wkd, key=wkd.get) if wkd else None
    top_locs = sorted(freq_locs.items(), key=lambda x:-x[1])[:3]
    ld = max(day_dist, key=day_dist.get) if day_dist else None
    return {
        "usual_departure": f"{top[1]:02d}:00 on weekdays" if top else None,
        "frequent_locations": [{"lat":lat,"lon":lon,"visits":c} for (lat,lon),c in top_locs],
        "longest_day": {"date": ld.strftime("%A %d %b") if ld else None,
                        "km": round(day_dist.get(ld,0),1) if ld else 0},
    }

def detect_anomalies(locs, now):
    anomalies = []
    for i in range(len(locs)-1):
        a,b = locs[i],locs[i+1]
        dt  = max((ts_utc(b.timestamp)-ts_utc(a.timestamp)).total_seconds(), 1)
        spd = (haversine(a.latitude,a.longitude,b.latitude,b.longitude)/dt)*3600
        if spd > 200:
            anomalies.append(f"⚡ Impossible speed {spd:.0f}km/h at {ts_utc(b.timestamp).strftime('%H:%M')}")
        elif spd > 150:
            anomalies.append(f"🚀 Very high speed {spd:.0f}km/h at {ts_utc(b.timestamp).strftime('%H:%M')}")
    if locs:
        age_h = (now - ts_utc(locs[-1].timestamp)).total_seconds()/3600
        if 4 <= age_h <= 12: anomalies.append(f"⏸️ Stationary {age_h:.1f}h - no movement")
        elif age_h > 12:     anomalies.append(f"🛑 No update in {age_h:.0f}h")
    return anomalies

def generate_predictions(locs, now):
    preds = []
    if len(locs) < 20: return preds
    hour_speeds = defaultdict(list)
    for loc in locs:
        ts = ts_utc(loc.timestamp)
        if loc.speed and loc.speed > 0: hour_speeds[ts.hour].append(loc.speed)
    next_h = (now.hour+1)%24
    if hour_speeds.get(next_h):
        avg = sum(hour_speeds[next_h])/len(hour_speeds[next_h])
        if avg > 5:
            preds.append(f"📈 You typically start moving around {next_h:02d}:00 based on history")
    if now.hour >= 17 and hour_speeds.get(now.hour):
        if sum(hour_speeds[now.hour])/len(hour_speeds[now.hour]) < 2:
            preds.append("🏠 You're usually winding down at this hour - heading home?")
    return preds

def check_proactive_alerts(db, now):
    from app.models import Location, User
    alerts = []
    try:
        for u in db.query(User).filter(User.is_active==True, User.is_admin==False).all():
            last = db.query(Location).filter(Location.user_id==u.id)\
                     .order_by(Location.timestamp.desc()).first()
            if not last: continue
            age = (now - ts_utc(last.timestamp)).total_seconds()
            if 8 <= now.hour <= 18 and age > 7200:
                alerts.append({"type":"stationary","icon":"⏸️","user":u.username,
                    "message":f"{u.username} stationary {age/3600:.1f}h",
                    "lat":last.latitude,"lon":last.longitude})
            recent = db.query(Location).filter(Location.user_id==u.id)\
                       .order_by(Location.timestamp.desc()).limit(3).all()
            for i in range(len(recent)-1):
                a,b = recent[i+1],recent[i]
                dt  = max((ts_utc(b.timestamp)-ts_utc(a.timestamp)).total_seconds(),1)
                spd = (haversine(a.latitude,a.longitude,b.latitude,b.longitude)/dt)*3600
                if spd > 200:
                    alerts.append({"type":"anomaly","icon":"⚡","user":u.username,
                        "message":f"Anomalous speed {spd:.0f}km/h for {u.username}",
                        "lat":b.latitude,"lon":b.longitude})
    except Exception as e:
        logger.warning(f"Alert error: {e}")
    return alerts

def generate_text_report(db, user, now):
    from app.models import Location
    week_ago = now - timedelta(days=7)
    locs = db.query(Location).filter(Location.user_id==user.id,
           Location.timestamp>=week_ago).order_by(Location.timestamp.asc()).all()
    if not locs: return "No location data for this week."
    trips     = detect_trips(locs)
    patterns  = detect_patterns(locs)
    anomalies = detect_anomalies(locs[-50:] if len(locs)>50 else locs, now)
    preds     = generate_predictions(locs, now)
    speeds    = [l.speed*3.6 for l in locs if l.speed and l.speed>0]
    lines = [
        f"📊 WEEKLY REPORT - {user.username}",
        f"Period: {week_ago.strftime('%d %b')} - {now.strftime('%d %b %Y')}",
        f"",f"📍 TRAVEL SUMMARY",
        f"  Total distance: {calc_dist(locs)} km",
        f"  Total trips: {len(trips)}",
        f"  Location points: {len(locs)}",
        f"  Avg speed: {(sum(speeds)/len(speeds) if speeds else 0):.1f} km/h",
        f"  Max speed: {(max(speeds) if speeds else 0):.1f} km/h","",
    ]
    if trips:
        lines.append("🗺️ TRIPS")
        for i,t in enumerate(trips[:10],1):
            lines.append(f"  {i}. {t['start_time']}-{t['end_time']} | {t['distance_km']}km | {t['duration_min']}min")
        lines.append("")
    if patterns.get("usual_departure"):
        lines += [f"📈 PATTERNS",f"  Departure: {patterns['usual_departure']}"]
        if patterns.get("longest_day",{}).get("date"):
            p=patterns["longest_day"]; lines.append(f"  Longest: {p['date']} ({p['km']}km)")
        lines.append("")
    if anomalies:
        lines += ["⚠️ ANOMALIES"] + [f"  {a}" for a in anomalies] + [""]
    if preds:
        lines += ["🔮 PREDICTIONS"] + [f"  {p}" for p in preds]
    return "\n".join(lines)

def fetch_real_data(db, user, is_admin):
    from app.models import Location, User, Geofence
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0,minute=0,second=0,microsecond=0)
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    if is_admin:
        try:
            all_u  = db.query(User).filter(User.is_active==True).all()
            reg    = [u for u in all_u if not u.is_admin]
            blocks, live_n, off_n = [], [], []
            for u in reg:
                last = db.query(Location).filter(Location.user_id==u.id)\
                         .order_by(Location.timestamp.desc()).first()
                tdl  = db.query(Location).filter(Location.user_id==u.id,
                         Location.timestamp>=today).order_by(Location.timestamp.asc()).all()
                wkl  = db.query(Location).filter(Location.user_id==u.id,
                         Location.timestamp>=week_ago).order_by(Location.timestamp.asc()).all()
                if last:
                    age  = (now-ts_utc(last.timestamp)).total_seconds()
                    live = age<300
                    place= reverse_geocode(last.latitude,last.longitude)
                    trips= detect_trips(tdl) if len(tdl)>=2 else []
                    anom = detect_anomalies(db.query(Location).filter(Location.user_id==u.id)
                             .order_by(Location.timestamp.desc()).limit(20).all()[::-1], now)
                    b = (f"  [{u.username}] {'🟢 LIVE' if live else '🔴 OFFLINE'} | Last: {ago(last.timestamp,now)}\n"
                         f"    📍 {place}\n"
                         f"    🌐 {last.latitude:.5f},{last.longitude:.5f}\n")
                    if last.speed: b += f"    🚗 {last.speed*3.6:.1f}km/h\n"
                    b += (f"    📊 Today: {len(tdl)}pts|{calc_dist(tdl)}km|{len(trips)}trips\n"
                          f"    📅 Week: {len(wkl)}pts|{calc_dist(wkl)}km\n"
                          f"    ✅ Consent: {'Yes' if u.is_consent_given else 'No'}\n")
                    if anom: b += f"    ⚠️ {'; '.join(anom)}\n"
                    blocks.append(b)
                    (live_n if live else off_n).append(u.username)
                else:
                    blocks.append(f"  [{u.username}] No data | Consent:{'Yes' if u.is_consent_given else 'No'}\n")
                    off_n.append(u.username)
            td_tot = db.query(Location).filter(Location.timestamp>=today).count()
            geos   = db.query(Geofence).all()
            geo_l  = "\n".join(f"  - {g.name}: {g.latitude:.4f},{g.longitude:.4f} r={g.radius}m" for g in geos) or "  None"
            proact = check_proactive_alerts(db,now)
            al_l   = "\n".join(f"  {a['icon']} {a['message']}" for a in proact) or "  None"
            return (f"=== TRACKAI ADMIN LIVE DATA ===\nTime: {now.strftime('%A %d %B %Y %H:%M UTC')}\n\n"
                    f"OVERVIEW:\n- Users: {len(all_u)} total|{len(reg)} regular|{len(live_n)} LIVE|{len(off_n)} offline\n"
                    f"- Live: {', '.join(live_n) or 'none'}\n- Offline: {', '.join(off_n) or 'none'}\n"
                    f"- Locations today: {td_tot}\n\nUSER DETAILS:\n{''.join(blocks)}\n"
                    f"GEOFENCES:\n{geo_l}\n\nPROACTIVE ALERTS:\n{al_l}\n================================")
        except Exception as e:
            logger.error(f"Admin data error: {e}", exc_info=True)
            return f"[Admin data error: {e}]"
    else:
        try:
            cur  = db.query(Location).filter(Location.user_id==user.id)\
                     .order_by(Location.timestamp.desc()).first()
            tdl  = db.query(Location).filter(Location.user_id==user.id,
                     Location.timestamp>=today).order_by(Location.timestamp.asc()).all()
            wkl  = db.query(Location).filter(Location.user_id==user.id,
                     Location.timestamp>=week_ago).order_by(Location.timestamp.asc()).all()
            mol  = db.query(Location).filter(Location.user_id==user.id,
                     Location.timestamp>=month_ago).order_by(Location.timestamp.asc()).all()
            geos = db.query(Geofence).filter(Geofence.user_id==user.id).all()

            curr_info = "No location recorded yet."
            if cur:
                place = reverse_geocode(cur.latitude,cur.longitude)
                ts    = ts_utc(cur.timestamp)
                curr_info = (f"📍 {place}\n   Coords: {cur.latitude:.6f},{cur.longitude:.6f}\n"
                             f"   Recorded: {ago(ts,now)} ({ts.strftime('%d %b %Y %H:%M')})\n")
                if cur.accuracy: curr_info += f"   Accuracy: +/-{cur.accuracy:.0f}m\n"
                if cur.speed:    curr_info += f"   Speed: {cur.speed*3.6:.1f}km/h\n"
                if cur.altitude: curr_info += f"   Altitude: {cur.altitude:.0f}m\n"
                if cur.heading:  curr_info += f"   Heading: {cur.heading:.0f}°\n"

            spds  = [l.speed*3.6 for l in wkl if l.speed and l.speed>0]
            trips = detect_trips(tdl)
            patt  = detect_patterns(mol) if len(mol)>=10 else {}
            anom  = detect_anomalies(wkl[-50:] if len(wkl)>50 else wkl, now)
            pred  = generate_predictions(mol, now)

            rec5 = db.query(Location).filter(Location.user_id==user.id)\
                     .order_by(Location.timestamp.desc()).limit(5).all()
            rec_text = "\n".join(
                f"  {i+1}. {r.latitude:.5f},{r.longitude:.5f} - {ago(r.timestamp,now)}"
                + (f" @ {r.speed*3.6:.0f}km/h" if r.speed else "")
                for i,r in enumerate(rec5)) or "  None"

            geo_t = ", ".join(f"{g.name}(r={g.radius}m)" for g in geos) or "None"
            trip_t = "\nTRIPS TODAY:\n" + "\n".join(
                f"  {i+1}. {t['start_time']}-{t['end_time']} | {t['distance_km']}km | {t['duration_min']}min"
                for i,t in enumerate(trips)) if trips else ""
            pat_t = ""
            if patt.get("usual_departure"): pat_t += f"\n- Usual departure: {patt['usual_departure']}"
            if patt.get("longest_day",{}).get("date"):
                p=patt["longest_day"]; pat_t += f"\n- Longest day: {p['date']} ({p['km']}km)"
            an_t  = ("\nANOMALIES:\n"+"\n".join(f"  {a}" for a in anom)) if anom else ""
            pr_t  = ("\nPREDICTIONS:\n"+"\n".join(f"  {p}" for p in pred)) if pred else ""

            return (f"=== TRACKAI USER DATA - {user.username.upper()} ===\n"
                    f"Time: {now.strftime('%A %d %B %Y %H:%M UTC')}\n"
                    f"Tracking: {'✅ Enabled' if user.is_consent_given else '❌ Disabled'}\n\n"
                    f"CURRENT LOCATION:\n{curr_info}\n"
                    f"RECENT POINTS:\n{rec_text}\n\n"
                    f"STATISTICS:\n"
                    f"- Today:  {len(tdl)}pts | {calc_dist(tdl)}km{f' | {len(trips)} trips' if trips else ''}\n"
                    f"- Week:   {len(wkl)}pts | {calc_dist(wkl)}km"
                    f" | avg {(sum(spds)/len(spds) if spds else 0):.1f}km/h"
                    f" | max {(max(spds) if spds else 0):.1f}km/h\n"
                    f"- Month:  {len(mol)}pts | {calc_dist(mol)}km\n"
                    f"{trip_t}\nGEOFENCES: {geo_t}{pat_t}{an_t}{pr_t}\n"
                    f"\nAPP FEATURES: MAP|TRACKING|HISTORY|NAVIGATE|GEOFENCES|SETTINGS|SOS\n================================")
        except Exception as e:
            logger.error(f"User data error: {e}", exc_info=True)
            return f"[User data error: {e}]"


@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not groq_client:
        raise HTTPException(status_code=503, detail="AI not configured. Add GROQ_API_KEY to .env")
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages")
    try:
        real_data = fetch_real_data(db, current_user, current_user.is_admin)
        msgs      = request.messages[-20:]
        last_msg  = msgs[-1].content if msgs else ""
        groq_msgs = [{"role":"system","content":SYSTEM_PROMPT}]
        for m in msgs[:-1]:
            groq_msgs.append({"role":"user" if m.role=="user" else "assistant","content":m.content})
        groq_msgs.append({"role":"user","content":(
            f"REAL-TIME LIVE DATA:\n{real_data}\n\n"
            f"USER MESSAGE: {last_msg}\n\n"
            f"Answer using real data above. Be specific, warm and friendly.")})
        resp  = groq_client.chat.completions.create(
            model=GROQ_MODEL, messages=groq_msgs,
            temperature=0.75, max_tokens=700, top_p=0.95)
        reply = resp.choices[0].message.content.strip()
        actions = [{"type":m.group(1).split(":")[0],
                    "value":m.group(1).split(":")[1] if ":" in m.group(1).split(":",1)[-1:][0:1] else None}
                   for m in re.finditer(r'\[ACTION:([^\]]+)\]', reply)]
        # fix action parsing
        actions = []
        for m in re.finditer(r'\[ACTION:([^\]]+)\]', reply):
            raw   = m.group(1)
            parts = raw.split(":", 1)
            actions.append({"type": parts[0], "value": parts[1] if len(parts) > 1 else None})
        clean = re.sub(r'\[ACTION:[^\]]+\]', '', reply).strip()
        return {"reply": clean, "role": "assistant", "actions": actions}
    except Exception as e:
        logger.error(f"Groq error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@router.get("/suggestions")
async def get_suggestions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if current_user.is_admin:
        alerts = check_proactive_alerts(db, now)
        al_s   = [f"{a['icon']} {a['message']}" for a in alerts[:2]]
        return {"suggestions": al_s + ["Who is live right now?","Show all user locations",
            "Any anomalies?","Give today's report","Weekly summary"]}
    from app.models import Location
    has = db.query(Location).filter(Location.user_id==current_user.id).first()
    if has:
        return {"suggestions":["Where am I right now?","How far today?","Show my trips",
            "Any anomalies?","What patterns do you see?","Generate my weekly report"]}
    return {"suggestions":["How do I start tracking?","What is TrackAI?",
        "How do geofences work?","How do I send SOS?"]}


@router.get("/alerts")
async def get_alerts(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not current_user.is_admin: return {"alerts":[]}
    return {"alerts": check_proactive_alerts(db, datetime.now(timezone.utc))}


@router.get("/report")
async def get_report(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    return {"report": generate_text_report(db, current_user, now),
            "generated_at": now.isoformat(), "user": current_user.username}


@router.get("/trips")
async def get_trips(days: int = 7, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from app.models import Location
    now   = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    locs  = db.query(Location).filter(Location.user_id==current_user.id,
              Location.timestamp>=since).order_by(Location.timestamp.asc()).all()
    return {"trips": detect_trips(locs), "patterns": detect_patterns(locs),
            "anomalies": detect_anomalies(locs[-100:] if len(locs)>100 else locs, now),
            "total_km": calc_dist(locs), "days": days}

# ── PDF Report endpoint ────────────────────────────────────────────────────────
@router.get("/report/pdf")
async def download_pdf_report(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Generate and download a PDF report for the user or admin."""
    from fastapi.responses import StreamingResponse
    import io
    import math as _math
    from app.models import Location, User, Geofence

    now      = datetime.now(timezone.utc)
    since    = now - timedelta(days=days)
    username = current_user.username

    def safe_ts(ts):
        if ts is None: return None
        return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts

    def calc_dist_pdf(locs):
        d = 0.0
        for i in range(len(locs)-1):
            R = 6371
            lat1,lon1,lat2,lon2 = map(_math.radians,[locs[i].latitude,locs[i].longitude,locs[i+1].latitude,locs[i+1].longitude])
            dlat,dlon = lat2-lat1, lon2-lon1
            a = _math.sin(dlat/2)**2 + _math.cos(lat1)*_math.cos(lat2)*_math.sin(dlon/2)**2
            d += R * 2 * _math.asin(_math.sqrt(a))
        return d

    try:
        from fpdf import FPDF

        locs = db.query(Location).filter(
            Location.user_id == current_user.id,
            Location.timestamp >= since
        ).order_by(Location.timestamp.asc()).all()

        total_km  = calc_dist_pdf(locs)
        speeds    = [l.speed for l in locs if l.speed and l.speed > 0]
        avg_speed = sum(speeds)/len(speeds) if speeds else 0
        max_speed = max(speeds) if speeds else 0
        geofences = db.query(Geofence).filter(Geofence.user_id == current_user.id).all()

        # Build PDF
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()

        # Header
        pdf.set_fill_color(30, 30, 50)
        pdf.rect(0, 0, 210, 40, 'F')
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 22)
        pdf.set_y(10)
        pdf.cell(0, 10, "TrackAI Location Report", ln=True, align="C")
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 8, f"User: {username} | Period: Last {days} days | Generated: {now.strftime('%d %b %Y %H:%M UTC')}", ln=True, align="C")
        pdf.ln(15)

        # Summary section
        pdf.set_text_color(30, 30, 50)
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_fill_color(240, 240, 255)
        pdf.cell(0, 10, "  Summary", ln=True, fill=True)
        pdf.ln(3)
        pdf.set_font("Helvetica", "", 11)

        summary_data = [
            ("Total Locations Logged", str(len(locs))),
            ("Total Distance Traveled", f"{total_km:.2f} km"),
            ("Average Speed", f"{avg_speed:.1f} m/s ({avg_speed*3.6:.1f} km/h)"),
            ("Maximum Speed", f"{max_speed:.1f} m/s ({max_speed*3.6:.1f} km/h)"),
            ("Geofences Set Up", str(len(geofences))),
            ("Report Period", f"{since.strftime('%d %b %Y')} to {now.strftime('%d %b %Y')}"),
        ]
        for label, value in summary_data:
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(80, 8, f"  {label}:", ln=False)
            pdf.set_font("Helvetica", "", 11)
            pdf.cell(0, 8, value, ln=True)
        pdf.ln(5)

        # Geofences
        if geofences:
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_fill_color(240, 240, 255)
            pdf.cell(0, 10, "  Geofences", ln=True, fill=True)
            pdf.ln(3)
            pdf.set_font("Helvetica", "", 10)
            for g in geofences:
                pdf.cell(0, 7, f"  - {g.name} | lat={g.latitude:.5f}, lon={g.longitude:.5f}, radius={g.radius}m", ln=True)
            pdf.ln(5)

        # Admin: add all users section
        if current_user.is_admin:
            all_users = db.query(User).filter(User.is_active == True, User.is_admin == False).all()
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_fill_color(240, 240, 255)
            pdf.cell(0, 10, "  User Overview", ln=True, fill=True)
            pdf.ln(3)
            pdf.set_font("Helvetica", "", 10)
            for u in all_users:
                last = db.query(Location).filter(Location.user_id == u.id)\
                         .order_by(Location.timestamp.desc()).first()
                status = "No data"
                if last:
                    ts   = safe_ts(last.timestamp)
                    diff = (now - ts).total_seconds()
                    status = "LIVE" if diff < 300 else f"Last seen {int(diff//3600)}h ago"
                consent = "Yes" if u.is_consent_given else "No"
                pdf.cell(0, 7, f"  - {u.username} ({u.email}) | Status: {status} | Consent: {consent}", ln=True)
            pdf.ln(5)

        # Recent locations table
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_fill_color(240, 240, 255)
        pdf.cell(0, 10, "  Recent Location History (last 20)", ln=True, fill=True)
        pdf.ln(3)

        # Table header
        pdf.set_fill_color(60, 60, 100)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(10,  8, "#",         border=1, fill=True, align="C")
        pdf.cell(55,  8, "Timestamp", border=1, fill=True, align="C")
        pdf.cell(40,  8, "Latitude",  border=1, fill=True, align="C")
        pdf.cell(40,  8, "Longitude", border=1, fill=True, align="C")
        pdf.cell(45,  8, "Accuracy",  border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_text_color(30, 30, 50)
        pdf.set_font("Helvetica", "", 8)
        recent = list(reversed(locs[-20:]))
        for i, loc in enumerate(recent):
            fill = i % 2 == 0
            pdf.set_fill_color(245, 245, 255) if fill else pdf.set_fill_color(255, 255, 255)
            ts_str = loc.timestamp.strftime("%d %b %Y %H:%M") if loc.timestamp else "N/A"
            acc    = f"+/-{loc.accuracy:.0f}m" if loc.accuracy else "N/A"
            pdf.cell(10,  7, str(i+1),                  border=1, fill=fill, align="C")
            pdf.cell(55,  7, ts_str,                    border=1, fill=fill, align="C")
            pdf.cell(40,  7, f"{loc.latitude:.5f}",     border=1, fill=fill, align="C")
            pdf.cell(40,  7, f"{loc.longitude:.5f}",    border=1, fill=fill, align="C")
            pdf.cell(45,  7, acc,                       border=1, fill=fill, align="C")
            pdf.ln()

        # Footer
        pdf.ln(10)
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 6, f"Generated by TrackAI | {now.strftime('%d %b %Y %H:%M UTC')} | Confidential", align="C")

        # Output as bytes
        pdf_bytes = pdf.output()
        buffer    = io.BytesIO(bytes(pdf_bytes))
        filename  = f"trackai_report_{username}_{now.strftime('%Y%m%d')}.pdf"

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except ImportError:
        # fpdf2 not installed - return JSON fallback
        raise HTTPException(
            status_code=501,
            detail="PDF generation requires fpdf2. Run: pip install fpdf2"
        )
    except Exception as e:
        logger.error(f"PDF report error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report error: {str(e)}")