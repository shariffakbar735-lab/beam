"""WebSocket route: /api/ws/{room_id}?device_id=... — realtime fan-out for one room."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from lib.db import db
from lib.realtime import hub

logger = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])

CLOSE_BAD_REQUEST = 4400
CLOSE_UNKNOWN_ROOM = 4404


@router.websocket("/ws/{room_id}")
async def room_socket(websocket: WebSocket, room_id: str) -> None:
    # Query params are read directly: a WebSocket handshake fails closed, so validation
    # belongs here rather than in a dependency that would 422 the upgrade request.
    device_id = (websocket.query_params.get("device_id") or "").strip()[:64]
    if not device_id:
        await websocket.close(code=CLOSE_BAD_REQUEST)
        return

    if await db.rooms.find_one({"id": room_id}, {"_id": 1}) is None:
        await websocket.close(code=CLOSE_UNKNOWN_ROOM)
        return

    await websocket.accept()
    await hub.connect(room_id, device_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except ValueError:
                continue
            if isinstance(event, dict) and event.get("type") == "ping":
                hub.touch(room_id, device_id)
                await websocket.send_json({"type": "pong"})
                await hub.publish_presence(room_id)
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # never leave a socket registered after an odd teardown
        logger.warning("websocket %s closed unexpectedly: %s", room_id, exc)
    finally:
        await hub.disconnect(websocket)
