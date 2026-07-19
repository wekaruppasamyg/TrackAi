"""
app/routes/realtime.py
──────────────────────
WebSocket route for live GPS tracking.

Endpoints
---------
  ws://host/api/ws/tracking?token=<JWT>&is_admin=true|false

• Admin clients  (is_admin=true)  → join the shared admin broadcast pool
• User  clients  (is_admin=false) → subscribe to their own user feed

The route delegates all connection-pool logic to the managers in
app.services.realtime, so this file stays thin.
"""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.realtime import (
    admin_manager,
    user_manager,
    is_admin_by_token,
    get_user_id_by_token,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/tracking")
async def websocket_tracking(
    websocket: WebSocket,
    token: str = Query(default=""),
    is_admin: bool = Query(default=False),
):
    """
    Single WebSocket endpoint for both admin dashboards and user map tabs.

    Query params
    ------------
    token    : JWT bearer token (required for both roles)
    is_admin : pass true to join the admin broadcast pool
    """

    # ── Admin path ──────────────────────────────────────────────────────────
    if is_admin:
        if not await is_admin_by_token(token):
            await websocket.close(code=4403, reason="Forbidden: not an admin")
            logger.warning("[WS] rejected admin connection — invalid/non-admin token")
            return

        await admin_manager.connect(websocket)
        try:
            while True:
                # Keep the connection alive; admins only receive, never send.
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            await admin_manager.disconnect(websocket)
        return

    # ── User path ───────────────────────────────────────────────────────────
    user_id = await get_user_id_by_token(token)
    if not user_id:
        await websocket.close(code=4401, reason="Unauthorized: invalid token")
        logger.warning("[WS] rejected user connection — invalid token")
        return

    await user_manager.connect(user_id, websocket)
    try:
        while True:
            # Keep alive; user map only receives location_update messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await user_manager.disconnect(user_id, websocket)