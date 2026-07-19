"""
Analytics service for AI-powered location analysis and reporting
"""

import logging
from collections import defaultdict
from importlib import import_module
from typing import Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import Location
from app.services.location import (
    get_locations_by_date_range,
    calculate_total_distance,
    get_location_statistics,
)
from app.config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

# Mock LLM response for demonstration
# In production, integrate with OpenAI API
def generate_ai_analysis(
    db: Session,
    user_id: str,
    question: str,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """
    Generate AI-powered analysis based on user's natural language question
    Includes travel summaries and efficiency recommendations.
    """
    # OpenAI Integration Pattern
    if OPENAI_API_KEY:
        try:
            openai = import_module("openai")
            openai.api_key = OPENAI_API_KEY
            
            stats = get_location_statistics(db, user_id, days=7)
            prompt = (
                f"Analyze this GPS data for user {user_id}: Total distance {stats['total_distance_km']}km, Avg speed {stats['average_speed']}m/s. "
                f"Question: {question}. Provide a travel summary and efficiency recommendations."
            )
            
            response = openai.ChatCompletion.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are TrackAI, an expert travel analyst."},
                    {"role": "user", "content": prompt}
                ]
            )
            return {
                "question": question,
                "answer": response.choices[0].message.content,
                "analysis_type": "ai_generated",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"OpenAI error, falling back to rule-based analysis: {e}")
    
    if date_to is None:
        date_to = datetime.now(timezone.utc)
    if date_from is None:
        date_from = date_to - timedelta(days=7)
    
    # Get relevant location data
    locations = get_locations_by_date_range(db, user_id, date_from, date_to)
    
    if not locations:
        return {
            "question": question,
            "answer": "No location data found for the specified period.",
            "analysis_type": "no_data",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    # Extract insights from location data
    insights = analyze_locations(locations, question)
    
    logger.info(f"AI Analysis generated for user {user_id}: {question}")
    
    return {
        "question": question,
        "answer": insights["answer"],
        "analysis_type": insights["type"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": insights.get("details"),
    }

def analyze_locations(locations: list, question: str) -> dict:
    """
    Analyze locations and generate insights based on the question
    This is a simplified implementation
    """
    
    total_distance = calculate_total_distance(locations)
    location_count = len(locations)
    time_span = (locations[-1].timestamp - locations[0].timestamp).total_seconds() / 3600  # hours
    
    # Simple question routing
    question_lower = question.lower()
    
    if any(word in question_lower for word in ["distance", "far", "long", "travel"]):
        efficiency = "High" if total_distance > 50 else "Optimal"
        return {
            "type": "distance_analysis",
            "answer": f"You traveled approximately {total_distance:.2f} km over {location_count} points. "
                      f"Efficiency: {efficiency}. Recommendation: Keep routes consistent to save time.",
            "details": {
                "total_distance_km": round(total_distance, 2),
                "location_points": location_count,
                "efficiency": efficiency
            }
        }
    
    elif any(word in question_lower for word in ["speed", "fast", "velocity"]):
        speeds = [loc.speed for loc in locations if loc.speed]
        avg_speed = sum(speeds) / len(speeds) if speeds else 0
        rec = "Optimal speed for fuel economy." if avg_speed < 20 else "High speed detected; reducing speed could improve efficiency."
        return {
            "type": "speed_analysis",
            "answer": f"Your average speed was {avg_speed:.2f} m/s over {time_span:.1f} hours. "
                      f"Recommendation: {rec}",
            "details": {
                "average_speed_ms": round(avg_speed, 2),
                "time_span_hours": round(time_span, 1),
                "efficiency_recommendation": rec
            }
        }
    
    elif "pattern" in question_lower or "habit" in question_lower:
        return {
            "type": "behavior_pattern",
            "answer": f"Based on {location_count} location points over {time_span:.1f} hours, your movement pattern shows consistent travel behavior.",
            "details": {
                "location_points": location_count,
                "time_span_hours": round(time_span, 1),
            }
        }
    
    else:
        return {
            "type": "general_summary",
            "answer": f"You have {location_count} location records spanning {time_span:.1f} hours with a total distance of {total_distance:.2f} km.",
            "details": {
                "location_points": location_count,
                "time_span_hours": round(time_span, 1),
                "total_distance_km": round(total_distance, 2),
            }
        }

def get_travel_summary(
    db: Session,
    user_id: str,
    days: int = 7,
) -> dict:
    """Generate a comprehensive travel summary"""
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    locations = get_locations_by_date_range(db, user_id, start_date, end_date)
    
    if not locations:
        return {
            "period_days": days,
            "summary": "No location data available",
        }
    
    stats = get_location_statistics(db, user_id, days)
    
    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_distance_km": stats["total_distance_km"],
        "total_location_points": stats["total_locations"],
        "average_speed_ms": stats["average_speed"],
        "summary": f"In the past {days} days, you traveled {stats['total_distance_km']} km at an avg speed of {stats['average_speed']} m/s across {stats['total_locations']} tracked points.",
    }

def get_ai_insights(db: Session, user_id: str, days: int = 7) -> dict:
    """Get AI-generated insights and efficiency recommendations"""
    stats = get_travel_summary(db, user_id, days)
    
    insights_list = [
        {
            "type": "activity_level",
            "description": "Your activity level is moderate with consistent daily movement.",
            "recommendation": "Maintain this level to ensure steady travel logs."
        }
    ]
    
    # Logical efficiency recommendation
    if stats.get("average_speed_ms", 0) > 12:
        insights_list.append({
            "type": "efficiency",
            "description": f"High average speed of {stats['average_speed_ms']} m/s detected.",
            "recommendation": "Plan routes to avoid peak traffic zones and reduce carbon footprint."
        })
    
    return {
        "user_id": user_id,
        "period_days": days,
        "travel_summary": stats,
        "insights": insights_list
    }


def get_admin_overview(db: Session, days: int = 7) -> dict:
    """Build admin-wide operational metrics and AI signals."""
    from app.models import Notification, SOSAlert, User

    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    today_start = end_date.replace(hour=0, minute=0, second=0, microsecond=0)

    users = db.query(User).filter(User.is_active == True).all()
    regular_users = [user for user in users if not user.is_admin]

    live_users = 0
    offline_users = []
    high_risk_users = []
    unusual_routes = []
    total_distance = 0.0
    trip_durations = []
    visited_locations = defaultdict(int)

    for user in regular_users:
        locations = get_locations_by_date_range(db, user.id, start_date, end_date)
        if not locations:
            offline_users.append(user.username)
            continue

        last_seen = locations[-1].timestamp
        # SQLite returns DateTime values without tzinfo. Normalise them before
        # comparing with the timezone-aware UTC dashboard clock.
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        else:
            last_seen = last_seen.astimezone(timezone.utc)
        age_seconds = (end_date - last_seen).total_seconds()
        if age_seconds <= 300:
            live_users += 1
        else:
            offline_users.append(user.username)

        total_distance += calculate_total_distance(locations)

        if len(locations) >= 2:
            trip_duration = (locations[-1].timestamp - locations[0].timestamp).total_seconds() / 60
            if trip_duration > 0:
                trip_durations.append(trip_duration)

        for location in locations:
            key = (round(location.latitude, 3), round(location.longitude, 3))
            visited_locations[key] += 1

        recent = locations[-25:]
        speeds = [loc.speed for loc in recent if loc.speed and loc.speed > 0]
        if speeds and max(speeds) * 3.6 > 90:
            high_risk_users.append(user.username)
            unusual_routes.append({
                "user": user.username,
                "type": "speed_violation",
                "message": f"High speed activity detected for {user.username}",
            })

    todays_alerts = db.query(Notification).filter(Notification.created_at >= today_start).count()
    todays_sos = db.query(SOSAlert).filter(SOSAlert.created_at >= today_start).count()

    avg_trip_time = round(sum(trip_durations) / len(trip_durations), 1) if trip_durations else 0
    top_locations = [
        {
            "lat": lat,
            "lon": lon,
            "visits": visits,
        }
        for (lat, lon), visits in sorted(visited_locations.items(), key=lambda item: item[1], reverse=True)[:5]
    ]

    device_status = {
        "live": live_users,
        "offline": len(offline_users),
        "consented": sum(1 for user in regular_users if user.is_consent_given),
    }

    insights = [
        {
            "type": "high_risk_users",
            "description": f"{len(high_risk_users)} users showed elevated risk signals.",
            "recommendation": "Review live location and recent route behavior for alerts.",
            "users": high_risk_users,
        },
        {
            "type": "offline_users",
            "description": f"{len(offline_users)} users are currently offline or stale.",
            "recommendation": "Check device power, consent status, and network coverage.",
            "users": offline_users,
        },
    ]

    if todays_sos:
        insights.append({
            "type": "sos_activity",
            "description": f"{todays_sos} SOS alerts were recorded today.",
            "recommendation": "Prioritize incident follow-up and response logs.",
        })

    if total_distance > 0:
        insights.append({
            "type": "daily_movement",
            "description": f"The fleet traveled {total_distance:.2f} km in the selected period.",
            "recommendation": "Use route replay to audit unusual movement spikes.",
        })

    return {
        "period_days": days,
        "generated_at": end_date.isoformat(),
        "cards": {
            "total_live_users": live_users,
            "todays_alerts": todays_alerts,
            "todays_sos": todays_sos,
            "distance_travelled_km": round(total_distance, 2),
            "average_trip_time_min": avg_trip_time,
            "device_status": device_status,
            "most_visited_locations": top_locations,
        },
        "insights": insights,
        "signals": {
            "high_risk_users": high_risk_users,
            "unusual_routes": unusual_routes,
            "offline_users": offline_users,
        },
    }
