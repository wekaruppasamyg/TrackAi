"""
SOS emergency routes.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SOSAlert, User
from app.routes.users import get_current_admin, get_current_user
from app.schemas import SOSCreate, SOSResponse
from app.services.notifications import create_notification, serialize_notification
from app.services.realtime import admin_manager

router = APIRouter()


def serialize_sos(alert: SOSAlert, user: User):
    payload = alert.to_dict()
    payload["user"] = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
    }
    return payload


@router.post("/activate", response_model=SOSResponse, status_code=status.HTTP_201_CREATED)
async def activate_sos(
    data: SOSCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = SOSAlert(
        user_id=user.id,
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy=data.accuracy,
        altitude=data.altitude,
        speed=data.speed,
        heading=data.heading,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    notification = create_notification(
        db,
        "sos_activated",
        user=user,
        latitude=alert.latitude,
        longitude=alert.longitude,
        sos_alert_id=alert.id,
        metadata={"accuracy": alert.accuracy},
    )

    await admin_manager.broadcast({
        "type": "sos_alert",
        "sos": serialize_sos(alert, user),
        "notification": serialize_notification(notification),
    })
    return alert


@router.get("", response_model=list[SOSResponse])
async def list_sos_alerts(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    return db.query(SOSAlert).order_by(SOSAlert.created_at.desc()).limit(limit).all()
