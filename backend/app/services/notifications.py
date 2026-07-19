"""
Notification creation and realtime broadcast helpers.
"""

import json
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models import Notification, User
from app.services.realtime import admin_manager


EVENT_COPY = {
    "sos_activated": ("SOS Activated", "{user} activated SOS emergency."),
    "user_online": ("User Online", "{user} is online."),
    "user_offline": ("User Offline", "{user} went offline."),
    "battery_low": ("Battery Low", "{user}'s device battery is low."),
    "gps_disabled": ("GPS Disabled", "{user}'s GPS/location access is disabled."),
    "destination_reached": ("Destination Reached", "{user} reached a destination."),
    "geofence_enter": ("Geofence Entered", "{user} entered a geofence."),
    "geofence_exit": ("Geofence Exited", "{user} exited a geofence."),
}


def display_name(user: Optional[User]) -> str:
    if not user:
        return "A user"
    return user.full_name or user.username or user.email or "A user"


def serialize_notification(notification: Notification) -> Dict[str, Any]:
    payload = notification.to_dict()
    if notification.user:
        payload["user"] = {
            "id": notification.user.id,
            "username": notification.user.username,
            "email": notification.user.email,
            "full_name": notification.user.full_name,
        }
    return payload


def create_notification(
    db: Session,
    event_type: str,
    user: Optional[User] = None,
    title: Optional[str] = None,
    message: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    sos_alert_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Notification:
    default_title, default_message = EVENT_COPY.get(event_type, ("Notification", "{user} has a new update."))
    name = display_name(user)
    notification = Notification(
        type=event_type,
        title=title or default_title,
        message=message or default_message.format(user=name),
        user_id=user.id if user else None,
        sos_alert_id=sos_alert_id,
        latitude=latitude,
        longitude=longitude,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


async def broadcast_notification(notification: Notification) -> None:
    await admin_manager.broadcast({
        "type": "notification",
        "notification": serialize_notification(notification),
    })
