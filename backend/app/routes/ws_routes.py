"""
WebSocket routes for live GPS tracking.

Mount this router in your main FastAPI app (main.py / app.py):

    from app.routes.ws_routes import router as ws_router
    app.include_router(ws_router, prefix="/api")

The frontend connects to:
    ws://localhost:8000/api/ws/tracking?token=<JWT>

Admin dashboards and regular users share the same endpoint.
The token decides which pool the connection joins.
"""

import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.database import SessionLocal
from app.models import User
from app.services.realtime import (
    admin_manager,
    user_manager,
    is_admin_by_token,
    get_user_id_by_token,
)
from app.services.notifications import create_notification, broadcast_notification

logger = logging.getLogger(__name__)
router = APIRouter()


async def notify_presence(user_id: str, event_type: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.is_admin:
            return
        notification = create_notification(db, event_type, user=user)
        await broadcast_notification(notification)
    except Exception as e:
        logger.warning("[WS] presence notification failed: %s", e)
    finally:
        db.close()


@router.websocket("/ws/tracking")
async def ws_tracking(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    Single WebSocket endpoint for both users and admins.

    - Admin token  → joins admin_manager pool (receives ALL users' updates)
    - User token   → joins user_manager pool  (receives own updates + geofence alerts)
    - Invalid token → connection is immediately closed with code 4001
    """

    # ── Authenticate ────────────────────────────────────────────────────────
    user_id = await get_user_id_by_token(token)
    if not user_id:
        # Reject unauthenticated connections before accepting
        await websocket.close(code=4001)
        logger.warning("[WS] rejected connection — invalid token")
        return

    is_admin = await is_admin_by_token(token)

    # ── Connect to the right pool ────────────────────────────────────────────
    if is_admin:
        await admin_manager.connect(websocket)
        logger.info("[WS-admin] %s connected", user_id)
        pool_label = "admin"
    else:
        await user_manager.connect(user_id, websocket)
        logger.info("[WS-user] %s connected", user_id)
        pool_label = "user"
        await notify_presence(user_id, "user_online")

    # ── Send a welcome ping so the frontend knows it's live ──────────────────
    try:
        await websocket.send_json({"type": "connected", "role": pool_label})
    except Exception:
        pass  # client already gone

    # ── Keep alive — read loop ───────────────────────────────────────────────
    # We don't expect messages from the client but we must keep the coroutine
    # alive. We also send periodic pings to prevent proxy timeouts (60 s).
    try:
        while True:
            try:
                # Wait for any client message (keepalive pong) with a timeout
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send a ping every 30 s to keep proxies happy
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break   # client gone

    except WebSocketDisconnect:
        logger.info("[WS-%s] %s disconnected", pool_label, user_id)
    except Exception as e:
        logger.warning("[WS-%s] %s error: %s", pool_label, user_id, e)
    finally:
        if is_admin:
            await admin_manager.disconnect(websocket)
        else:
            await user_manager.disconnect(user_id, websocket)
            await notify_presence(user_id, "user_offline")
        logger.info("[WS-%s] %s cleaned up", pool_label, user_id)
