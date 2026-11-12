"""In-process WebSocket hub: room → device sockets, plus "who is here right now".

One uvicorn worker, so in-memory state is authoritative for presence. A dropped
socket keeps its device "online" for PRESENCE_WINDOW_SECONDS so a device that fell
back to HTTP polling still reads as online (its presence poll refreshes last_seen).
"""

import asyncio
import logging
import time

from fastapi import WebSocket

PRESENCE_WINDOW_SECONDS = 20.0

logger = logging.getLogger(__name__)


class Hub:
    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = {}
        self._owner: dict[WebSocket, tuple[str, str]] = {}
        self._last_seen: dict[str, dict[str, float]] = {}
        self._published: dict[str, frozenset[str]] = {}
        self._lock = asyncio.Lock()

    def touch(self, room_id: str, device_id: str) -> None:
        """Mark a device as present (called by the WS ping and by every HTTP poll)."""
        self._last_seen.setdefault(room_id, {})[device_id] = time.monotonic()

    def online(self, room_id: str) -> list[str]:
        now = time.monotonic()
        seen = self._last_seen.get(room_id, {})
        return sorted(device for device, ts in seen.items() if now - ts <= PRESENCE_WINDOW_SECONDS)

    async def connect(self, room_id: str, device_id: str, socket: WebSocket) -> None:
        async with self._lock:
            self._sockets.setdefault(room_id, set()).add(socket)
            self._owner[socket] = (room_id, device_id)
            self.touch(room_id, device_id)
        await self.publish_presence(room_id, force=True)

    async def disconnect(self, socket: WebSocket) -> None:
        async with self._lock:
            owner = self._owner.pop(socket, None)
            if owner is None:
                return
            room_id, device_id = owner
            peers = self._sockets.get(room_id)
            if peers is not None:
                peers.discard(socket)
                if not peers:
                    self._sockets.pop(room_id, None)
            # Another tab of the same device still holds a socket? Then it is still online.
            still_open = any(
                self._owner.get(other) == (room_id, device_id)
                for other in self._sockets.get(room_id, ())
            )
            if not still_open:
                self._last_seen.get(room_id, {}).pop(device_id, None)
        await self.publish_presence(room_id, force=True)

    async def publish_presence(self, room_id: str, force: bool = False) -> None:
        current = frozenset(self.online(room_id))
        if not force and self._published.get(room_id) == current:
            return
        self._published[room_id] = current
        await self.broadcast(room_id, {"type": "presence", "device_ids": sorted(current)})

    async def broadcast(self, room_id: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for socket in list(self._sockets.get(room_id, ())):
            try:
                await socket.send_json(payload)
            except Exception as exc:  # a half-closed socket must not kill the fan-out
                logger.debug("broadcast to %s failed: %s", room_id, exc)
                dead.append(socket)
        # `disconnect` re-publishes presence; each level targets fewer sockets, so this settles.
        for socket in dead:
            await self.disconnect(socket)


hub = Hub()
