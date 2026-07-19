"""
Admin realtime notifications.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, User
from app.routes.users import get_current_admin, get_current_user
from app.schemas import NotificationEventCreate, NotificationResponse
from app.services.notifications import create_notification, broadcast_notification

router = APIRouter()

ALLOWED_USER_EVENTS = {
    "battery_low",
    "gps_disabled",
    "destination_reached",
}


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return (
        db.query(Notification)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/events", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_user_event(
    event: NotificationEventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if event.type not in ALLOWED_USER_EVENTS:
        raise HTTPException(status_code=400, detail="Unsupported notification event")

    notification = create_notification(
        db,
        event.type,
        user=user,
        latitude=event.latitude,
        longitude=event.longitude,
        metadata=event.metadata,
    )
    await broadcast_notification(notification)
    return notification


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.put("/read-all")
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "Notifications marked as read"}
