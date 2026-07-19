"""
Location tracking routes
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.schemas import LocationCreate, LocationResponse
from app.services import location as location_service
from app.models import Location, User
from app.routes.users import get_current_user
from app.services.realtime import broadcast_location_update

logger = logging.getLogger(__name__)
router = APIRouter()


# ── POST must come BEFORE /{location_id} ────────────────────────────
@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new location entry. Requires GPS consent."""
    if not user.is_consent_given:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has not given GPS tracking consent"
        )

    try:
        location = location_service.create_location(db, str(user.id), location_data)
    except Exception as e:
        logger.error(f"DB error creating location: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save location: {str(e)}"
        )

    # Geofence check — non-fatal
    try:
        from app.models import Geofence
        from app.services import geofence as geofence_service
        from app.services.notifications import create_notification, broadcast_notification

        events = geofence_service.check_geofence_events(db, user.id, location)
        for geofence_id, event_type in events:
            geofence = db.query(Geofence).filter(Geofence.id == geofence_id).first()
            notification = create_notification(
                db,
                f"geofence_{event_type}",
                user=user,
                latitude=location.latitude,
                longitude=location.longitude,
                metadata={
                    "geofence_id": geofence_id,
                    "geofence_name": geofence.name if geofence else "",
                },
            )
            await broadcast_notification(notification)
    except Exception as e:
        logger.warning(f"Geofence check failed (non-fatal): {e}")

    # WebSocket broadcast — non-fatal
    #
    # This now goes through broadcast_location_update() (realtime.py)
    # instead of building the payload and calling admin_manager /
    # user_manager directly here. Two reasons:
    #   1. That helper is where the duplicate-broadcast dedup filter lives
    #      (skips re-broadcasting if the same user's coordinates arrived
    #      again within ~1s — e.g. a client retry or a second open tab).
    #      Calling admin_manager.broadcast() directly, like this route
    #      used to, bypassed that filter entirely.
    #   2. Single source of truth for the wire payload shape — no risk of
    #      this route and realtime.py drifting apart on field names.
    try:
        await broadcast_location_update(str(user.id), location)
    except Exception as e:
        logger.warning(f"WS broadcast failed (non-fatal): {e}")

    return location


# ── GET list ─────────────────────────────────────────────────────────
@router.get("", response_model=list[LocationResponse])
async def get_locations(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get recent locations for the current user"""
    return location_service.get_user_locations(db, str(user.id), limit, offset)


# ── Named GET routes BEFORE /{location_id} ──────────────────────────
@router.get("/history", response_model=list[LocationResponse])
async def get_location_history(
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get location history for a date range"""
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
    if not end_date:
        end_date = datetime.now(timezone.utc)
    return location_service.get_locations_by_date_range(db, str(user.id), start_date, end_date)


@router.get("/history/admin/{user_id}", response_model=list[LocationResponse])
async def get_admin_location_history(
    user_id: str,
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get another user's location history for admin route replay."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    return location_service.get_locations_by_date_range(db, user_id, start_date, end_date)


@router.get("/statistics")
async def get_statistics(
    days: int = Query(7, ge=1, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get location statistics for the past N days"""
    return location_service.get_location_statistics(db, str(user.id), days)


# ── /{location_id} LAST — catches everything else ───────────────────
@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get a specific location by ID"""
    location = db.query(Location).filter(
        Location.id == location_id,
        Location.user_id == user.id
    ).first()

    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    return location