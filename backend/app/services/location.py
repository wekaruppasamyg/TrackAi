"""
Location service for GPS tracking and location analytics
"""

import logging
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Location, User
from app.schemas import LocationCreate
import math

logger = logging.getLogger(__name__)

EARTH_RADIUS_KM = 6371


def create_location(db: Session, user_id: str, location_data: LocationCreate) -> Location:
    """Create a new location entry for a user"""
    location = Location(
        user_id=user_id,
        latitude=location_data.latitude,
        longitude=location_data.longitude,
        accuracy=location_data.accuracy,
        altitude=location_data.altitude,
        speed=location_data.speed,
        heading=location_data.heading,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    logger.info(f"Location created for user {user_id}")
    return location


def get_user_locations(
    db: Session,
    user_id: str,
    limit: int = 100,
    offset: int = 0,
) -> List[Location]:
    """Get recent locations for a user"""
    return (
        db.query(Location)
        .filter(Location.user_id == user_id)
        .order_by(Location.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_locations_by_date_range(
    db: Session,
    user_id: str,
    start_date: datetime,
    end_date: datetime,
) -> List[Location]:
    """
    Get locations for a user within a date range.
    Returns oldest-first so frontend polylines draw in travel direction.
    """
    return (
        db.query(Location)
        .filter(
            Location.user_id == user_id,
            Location.timestamp >= start_date,
            Location.timestamp <= end_date,
        )
        .order_by(Location.timestamp.asc())
        .all()
    )


def serialize_location(loc: Location) -> dict:
    """Convert a Location ORM object to a plain dict safe for JSON serialisation."""
    return {
        "id":        str(loc.id),
        "latitude":  loc.latitude,
        "longitude": loc.longitude,
        "accuracy":  loc.accuracy,
        "altitude":  loc.altitude,
        "speed":     loc.speed,
        "heading":   loc.heading,
        "timestamp": loc.timestamp.isoformat() if loc.timestamp else None,
    }


def get_route_history(
    db: Session,
    user_id: str,
    start_date: str,
    end_date: str,
) -> List[dict]:
    """
    Parse date strings, query the DB, and return serialised location dicts.
    Called directly from the /history route handler.
    Accepts ISO strings like '2024-06-25T00:00:00' or '2024-06-25T23:59:59'.
    """
    def parse_dt(s: str) -> datetime:
        s = s.strip()
        if s.endswith('Z'):
            s = s[:-1] + '+00:00'
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    start = parse_dt(start_date)
    end   = parse_dt(end_date)

    locations = get_locations_by_date_range(db, user_id, start, end)
    return [serialize_location(loc) for loc in locations]


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance between two coords — returns kilometres."""
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_KM * c


def calculate_total_distance(locations: List[Location]) -> float:
    """Total distance travelled from an ordered list of Location objects."""
    if len(locations) < 2:
        return 0.0
    total = 0.0
    for i in range(len(locations) - 1):
        cur  = locations[i]
        nxt  = locations[i + 1]
        total += calculate_distance(cur.latitude, cur.longitude, nxt.latitude, nxt.longitude)
    return total


def get_location_statistics(db: Session, user_id: str, days: int = 7) -> dict:
    """Location statistics for a user over the past N days."""
    now        = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    locations  = get_locations_by_date_range(db, user_id, start_date, now)

    if not locations:
        return {
            "total_locations":  0,
            "total_distance_km": 0.0,
            "average_speed":    0.0,
            "highest_altitude": 0.0,
        }

    total_distance = calculate_total_distance(locations)
    speeds    = [loc.speed    for loc in locations if loc.speed    is not None]
    altitudes = [loc.altitude for loc in locations if loc.altitude is not None]

    return {
        "total_locations":   len(locations),
        "total_distance_km": round(total_distance, 2),
        "average_speed":     round(sum(speeds) / len(speeds), 2) if speeds else 0.0,
        "highest_altitude":  round(max(altitudes), 2)            if altitudes else 0.0,
        "date_range": {
            "start": start_date.isoformat(),
            "end":   now.isoformat(),
        },
    }