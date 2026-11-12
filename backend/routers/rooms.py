"""Room + message + attachment routes, all mounted under /api/rooms by server.py."""

import secrets
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query

from lib.db import db
from lib.realtime import hub
from models.beam import (
    MESSAGE_TTL_SECONDS,
    ROOM_ID_ALPHABET,
    ROOM_ID_LENGTH,
    Attachment,
    AttachmentMeta,
    ClearResult,
    Message,
    MessageCreate,
    Presence,
    Room,
    utc_now,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _new_room_id() -> str:
    return "".join(secrets.choice(ROOM_ID_ALPHABET) for _ in range(ROOM_ID_LENGTH))


async def _require_room(room_id: str) -> None:
    if await db.rooms.find_one({"id": room_id}, {"_id": 1}) is None:
        raise HTTPException(status_code=404, detail="room not found")


async def _sweep_expired(room_id: str) -> int:
    """Belt-and-braces for the TTL indexes: never hand back anything older than 24 h."""
    cutoff = utc_now() - timedelta(seconds=MESSAGE_TTL_SECONDS)
    messages = await db.messages.delete_many({"room_id": room_id, "created_at": {"$lt": cutoff}})
    await db.attachments.delete_many({"room_id": room_id, "created_at": {"$lt": cutoff}})
    return messages.deleted_count


@router.post("", response_model=Room, status_code=201)
async def create_room() -> Room:
    """Create a room. The room id is public; the decryption key never reaches us."""
    for _ in range(5):
        room = Room(id=_new_room_id(), created_at=utc_now())
        if await db.rooms.find_one({"id": room.id}, {"_id": 1}) is None:
            await db.rooms.insert_one(room.model_dump())
            return room
    raise HTTPException(status_code=503, detail="could not allocate a room id")


@router.get("/{room_id}", response_model=Room)
async def get_room(room_id: str) -> Room:
    doc = await db.rooms.find_one({"id": room_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="room not found")
    return Room(**doc)


@router.get("/{room_id}/messages", response_model=list[Message])
async def list_messages(room_id: str) -> list[Message]:
    await _require_room(room_id)
    await _sweep_expired(room_id)
    cursor = db.messages.find({"room_id": room_id}).sort([("created_at", 1), ("id", 1)])
    return [Message(**doc) for doc in await cursor.to_list(2000)]


@router.post("/{room_id}/messages", response_model=Message, status_code=201)
async def create_message(room_id: str, payload: MessageCreate) -> Message:
    await _require_room(room_id)
    created_at = utc_now()
    upload = payload.attachment

    message = Message(
        room_id=room_id,
        sender_id=payload.sender_id,
        device_label=payload.device_label,
        iv=payload.iv,
        ciphertext=payload.ciphertext,
        created_at=created_at,
        attachment=(
            AttachmentMeta(
                name=upload.name, mime=upload.mime, size=upload.size, kind=upload.kind
            )
            if upload is not None
            else None
        ),
    )
    await db.messages.insert_one(message.model_dump())

    if upload is not None:
        # Same created_at as the message so both TTL indexes expire them together.
        await db.attachments.insert_one(
            {
                "message_id": message.id,
                "room_id": room_id,
                "name": upload.name,
                "mime": upload.mime,
                "size": upload.size,
                "kind": upload.kind,
                "iv": upload.iv,
                "data": upload.data,
                "created_at": created_at,
            }
        )

    # Fan out to every socket in the room (sender included — the client dedupes by id).
    await hub.broadcast(room_id, {"type": "message", "message": message.model_dump(mode="json")})
    return message


@router.get("/{room_id}/messages/{message_id}/attachment", response_model=Attachment)
async def get_attachment(room_id: str, message_id: str) -> Attachment:
    """The encrypted file, fetched lazily by whichever device wants to render it."""
    await _require_room(room_id)
    doc = await db.attachments.find_one({"message_id": message_id, "room_id": room_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="attachment not found")
    return Attachment(**doc)


@router.delete("/{room_id}/messages", response_model=ClearResult)
async def clear_messages(room_id: str) -> ClearResult:
    """Clear all: delete the room's messages and blobs, and tell every device to drop them."""
    await _require_room(room_id)
    messages = await db.messages.delete_many({"room_id": room_id})
    attachments = await db.attachments.delete_many({"room_id": room_id})
    await hub.broadcast(room_id, {"type": "cleared"})
    return ClearResult(deleted=messages.deleted_count, attachments_deleted=attachments.deleted_count)


@router.get("/{room_id}/presence", response_model=Presence)
async def get_presence(
    room_id: str,
    device_id: str = Query(min_length=1, max_length=64),
) -> Presence:
    """Doubles as the polling fallback's heartbeat and as the peer-online read."""
    await _require_room(room_id)
    hub.touch(room_id, device_id)
    await hub.publish_presence(room_id)
    online = hub.online(room_id)
    return Presence(
        room_id=room_id,
        online_device_ids=online,
        peer_online=any(other != device_id for other in online),
    )
