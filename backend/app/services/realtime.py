"""
WebSocket connection managers + broadcast helpers for live tracking.

Call `await broadcast_location_update(user_id, location)` from the
location-creation API route after saving to DB — that's the single place
that triggers all downstream live updates for both the user's own map
and the admin dashboard.
"""

import asyncio
import logging
from typing import Set, Dict, Optional
from fastapi import WebSocket

from app.services.auth import verify_token

logger = logging.getLogger(__name__)


# ── Admin websocket manager ──────────────────────────────────────────────────
# One shared pool; every authenticated admin that opens /ws/tracking
# and passes is_admin=True gets added here.

class AdminConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active.add(websocket)
        logger.info("[WS-admin] client connected — pool size %d", len(self.active))

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            self.active.discard(websocket)
        logger.info("[WS-admin] client disconnected — pool size %d", len(self.active))

    async def broadcast(self, message: dict):
        async with self.lock:
            targets = list(self.active)

        dead = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        if dead:
            async with self.lock:
                for ws in dead:
                    self.active.discard(ws)


admin_manager = AdminConnectionManager()


# ── User websocket manager ───────────────────────────────────────────────────
# keyed by user_id; a user's own map subscribes here.

class UserConnectionManager:
    def __init__(self):
        self.active: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active.setdefault(user_id, set()).add(websocket)
        logger.info("[WS-user] %s connected", user_id)

    async def disconnect(self, user_id: str, websocket: WebSocket):
        async with self.lock:
            if user_id in self.active:
                self.active[user_id].discard(websocket)
                if not self.active[user_id]:
                    self.active.pop(user_id, None)
        logger.info("[WS-user] %s disconnected", user_id)

    async def send_to_user(self, user_id: str, message: dict):
        async with self.lock:
            targets = list(self.active.get(user_id, set()))

        dead = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        if dead:
            async with self.lock:
                for ws in dead:
                    if user_id in self.active:
                        self.active[user_id].discard(ws)


user_manager = UserConnectionManager()


# ── Single broadcast helper ─────────────────────────────────────────────────
# Call this from the location POST route after saving to DB.
# It pushes to:
#   1. All connected admin dashboards  (admin_manager.broadcast)
#   2. The user's own map tab          (user_manager.send_to_user)

async def broadcast_location_update(user_id: str, location) -> None:
    """
    Broadcast a saved Location ORM object (or dict) to all live WebSocket
    consumers.  `location` can be either a SQLAlchemy model instance or a
    plain dict — we normalise here so callers don't have to.
    """
    if hasattr(location, "__dict__"):
        # SQLAlchemy model — pull scalar fields
        loc_dict = {
            "id":        str(location.id),
            "latitude":  location.latitude,
            "longitude": location.longitude,
            "accuracy":  location.accuracy,
            "altitude":  location.altitude,
            "speed":     location.speed,
            "heading":   location.heading,
            "timestamp": location.timestamp.isoformat() if location.timestamp else None,
        }
    else:
        loc_dict = location  # already a dict / pydantic .dict()

    message = {
        "type":     "location_update",
        "user_id":  str(user_id),
        "location": loc_dict,
    }

    # Fire both concurrently so neither waits for the other
    await asyncio.gather(
        admin_manager.broadcast(message),
        user_manager.send_to_user(str(user_id), message),
        return_exceptions=True,   # don't let one failure abort the other
    )
    logger.debug("[WS] broadcast location_update for user %s", user_id)


# ── Auth helpers used by the WS route ───────────────────────────────────────

async def is_admin_by_token(token: str) -> bool:
    if not token:
        return False

    user_id = verify_token(token)
    if not user_id:
        return False

    from app.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        return bool(user and user.is_admin and user.is_active)
    finally:
        db.close()


async def get_user_id_by_token(token: str) -> Optional[str]:
    if not token:
        return None
    return verify_token(token)