"""
Geofence service for location-based alerts and boundary management
"""

import logging
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models import Geofence, Location
from app.schemas import GeofenceCreate, GeofenceUpdate
from app.services.location import calculate_distance
from app.config import DEFAULT_GEOFENCE_RADIUS

logger = logging.getLogger(__name__)

def create_geofence(db: Session, user_id: str, geofence_data: GeofenceCreate) -> Geofence:
    """Create a new geofence for a user"""
    geofence = Geofence(
        user_id=user_id,
        name=geofence_data.name,
        description=geofence_data.description,
        latitude=geofence_data.latitude,
        longitude=geofence_data.longitude,
        radius=geofence_data.radius,
    )
    
    db.add(geofence)
    db.commit()
    db.refresh(geofence)
    logger.info(f"Geofence created: {geofence.name} for user {user_id}")
    return geofence

def get_user_geofences(db: Session, user_id: str) -> List[Geofence]:
    """Get all geofences for a user"""
    return db.query(Geofence).filter(
        Geofence.user_id == user_id
    ).order_by(Geofence.created_at.desc()).all()

def get_all_geofences(db: Session) -> List[Geofence]:
    """Admin only: get every geofence across all users."""
    return db.query(Geofence).order_by(Geofence.created_at.desc()).all()

def get_geofence_by_id(db: Session, user_id: str, geofence_id: str) -> Geofence:
    """Get a specific geofence by ID"""
    return db.query(Geofence).filter(
        Geofence.id == geofence_id,
        Geofence.user_id == user_id
    ).first()

def get_geofence_by_id_any(db: Session, geofence_id: str) -> Geofence:
    """Admin only: get a geofence by ID regardless of who owns it."""
    return db.query(Geofence).filter(Geofence.id == geofence_id).first()

def update_geofence(
    db: Session,
    user_id: str,
    geofence_id: str,
    geofence_data: GeofenceUpdate,
) -> Geofence:
    """Update an existing geofence"""
    geofence = get_geofence_by_id(db, user_id, geofence_id)
    if not geofence:
        return None
    
    update_data = geofence_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(geofence, key, value)
    
    db.add(geofence)
    db.commit()
    db.refresh(geofence)
    logger.info(f"Geofence updated: {geofence.id}")
    return geofence

def delete_geofence(db: Session, user_id: str, geofence_id: str) -> bool:
    """Delete a geofence"""
    geofence = get_geofence_by_id(db, user_id, geofence_id)
    if not geofence:
        return False
    
    db.delete(geofence)
    db.commit()
    logger.info(f"Geofence deleted: {geofence_id}")
    return True

def is_location_inside_geofence(
    location_lat: float,
    location_lon: float,
    geofence: Geofence,
) -> bool:
    """Check if a location is inside a geofence"""
    distance_km = calculate_distance(
        location_lat,
        location_lon,
        geofence.latitude,
        geofence.longitude,
    )
    distance_meters = distance_km * 1000
    return distance_meters <= geofence.radius

def check_geofence_events(
    db: Session,
    user_id: str,
    location: Location,
) -> List[Tuple[str, str]]:  # List of (geofence_id, event_type)
    """Check if a location triggers any geofence events"""
    geofences = get_user_geofences(db, user_id)
    events = []
    
    for geofence in geofences:
        if not geofence.is_active:
            continue
        
        is_inside = is_location_inside_geofence(
            location.latitude,
            location.longitude,
            geofence,
        )
        
        # Get previous location to determine enter/exit
        previous_location = db.query(Location).filter(
            Location.user_id == user_id,
            Location.id != (location.id if location.id else ""),
        ).order_by(Location.timestamp.desc()).first()
        
        if previous_location:
            was_inside = is_location_inside_geofence(
                previous_location.latitude,
                previous_location.longitude,
                geofence,
            )
            
            if is_inside and not was_inside:
                events.append((geofence.id, "enter"))
                logger.info(f"Geofence ENTER: {geofence.name} for user {user_id}")
            elif not is_inside and was_inside:
                events.append((geofence.id, "exit"))
                logger.info(f"Geofence EXIT: {geofence.name} for user {user_id}")
    
    return events