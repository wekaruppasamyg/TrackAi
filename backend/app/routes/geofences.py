"""
Geofence management routes
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import GeofenceCreate, GeofenceUpdate, GeofenceResponse, GeofenceAdminItem
from app.services import geofence as geofence_service
from app.routes.users import get_current_user, get_current_admin

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("", response_model=GeofenceResponse, status_code=status.HTTP_201_CREATED)
async def create_geofence(
    geofence_data: GeofenceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new geofence.

    Normally the geofence is owned by whoever calls this (unchanged from
    before). Admins may optionally include `user_id` in the request body to
    create a geofence that applies to a *different* user's location
    updates — this is what powers "assign to user" in the admin panel.
    """
    target_user_id = user.id
    if user.is_admin and geofence_data.user_id:
        target_user_id = geofence_data.user_id

    try:
        geofence = geofence_service.create_geofence(db, target_user_id, geofence_data)
        return geofence
    except Exception as e:
        logger.error(f"Error creating geofence: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create geofence"
        )

@router.get("", response_model=list[GeofenceResponse])
async def get_geofences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all geofences for the current user"""
    geofences = geofence_service.get_user_geofences(db, user.id)
    return geofences

@router.get("/admin/all", response_model=list[GeofenceAdminItem])
async def get_all_geofences_admin(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Admin only: list every geofence across every user, with the owning
    user's username/email attached, so the admin panel can show and manage
    geofences that belong to users other than the admin itself.

    NOTE: registered before /{geofence_id} so "admin" is never swallowed
    as a geofence_id path parameter.
    """
    geofences = geofence_service.get_all_geofences(db)

    owner_ids = {g.user_id for g in geofences}
    owners = {}
    if owner_ids:
        for u in db.query(User).filter(User.id.in_(owner_ids)).all():
            owners[u.id] = u

    result = []
    for g in geofences:
        owner = owners.get(g.user_id)
        result.append(
            GeofenceAdminItem(
                id=g.id,
                user_id=g.user_id,
                owner_username=owner.username if owner else None,
                owner_email=owner.email if owner else None,
                name=g.name,
                description=g.description,
                latitude=g.latitude,
                longitude=g.longitude,
                radius=g.radius,
                is_active=g.is_active,
                created_at=g.created_at,
            )
        )
    return result

@router.get("/{geofence_id}", response_model=GeofenceResponse)
async def get_geofence(
    geofence_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific geofence by ID"""
    geofence = geofence_service.get_geofence_by_id(db, user.id, geofence_id)
    
    if not geofence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geofence not found"
        )
    
    return geofence

@router.put("/{geofence_id}", response_model=GeofenceResponse)
async def update_geofence(
    geofence_id: str,
    geofence_data: GeofenceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a geofence (also used to enable/disable via is_active).

    Regular users can only update their own geofence (unchanged). Admins
    can update any user's geofence, since the admin panel manages
    geofences across the whole fleet, not just the admin's own.
    """
    if user.is_admin:
        existing = geofence_service.get_geofence_by_id_any(db, geofence_id)
        owner_id = existing.user_id if existing else None
    else:
        owner_id = user.id

    geofence = (
        geofence_service.update_geofence(db, owner_id, geofence_id, geofence_data)
        if owner_id else None
    )

    if not geofence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geofence not found"
        )
    
    return geofence

@router.delete("/{geofence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_geofence(
    geofence_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a geofence. Admins may delete any user's geofence."""
    if user.is_admin:
        existing = geofence_service.get_geofence_by_id_any(db, geofence_id)
        owner_id = existing.user_id if existing else None
    else:
        owner_id = user.id

    success = (
        geofence_service.delete_geofence(db, owner_id, geofence_id)
        if owner_id else False
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geofence not found"
        )
    
    return None