"""Pydantic v2 models for Beam — rooms, encrypted messages, attachments, presence.

Beam never sees plaintext: a message body arrives as AES-GCM `iv` + `ciphertext`
(base64), both produced in the browser. Attachments arrive the same way — the file
bytes are encrypted client-side and stored as an opaque base64 blob, so the server
holds an image it cannot look at.
"""

from datetime import datetime, timezone
from typing import Literal
import uuid

from pydantic import BaseModel, Field

# Crockford-ish alphabet (no I, L, O, U): 20 chars ≈ 99 bits of entropy, and the
# room id is safe to read aloud / retype when a QR scan fails.
ROOM_ID_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"
ROOM_ID_LENGTH = 20

# A 10 000-character plaintext limit is enforced in the browser; base64 of that
# plus the AES-GCM tag lands near 13.4 kB, so 20 kB is the server-side wire ceiling.
MAX_CIPHERTEXT_LENGTH = 20_000
MAX_PLAINTEXT_LENGTH = 10_000

# Attachments: 2 MB of raw file, which becomes ~2.8 MB once encrypted and base64'd.
MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
MAX_ATTACHMENT_B64_LENGTH = 2_900_000

# Messages (and their attachments) self-destruct 24 h after they are written.
MESSAGE_TTL_SECONDS = 24 * 60 * 60


def utc_now() -> datetime:
    """Aware UTC — motor hands back naive datetimes, so always write with tzinfo."""
    return datetime.now(timezone.utc)


class Room(BaseModel):
    id: str
    created_at: datetime


AttachmentKind = Literal["image", "file"]


class AttachmentCreate(BaseModel):
    name: str = Field(default="file", min_length=1, max_length=120)
    mime: str = Field(default="application/octet-stream", min_length=1, max_length=120)
    size: int = Field(ge=0, le=MAX_ATTACHMENT_BYTES)
    kind: AttachmentKind = "file"
    iv: str = Field(min_length=1, max_length=64)
    data: str = Field(min_length=1, max_length=MAX_ATTACHMENT_B64_LENGTH)


class AttachmentMeta(BaseModel):
    """What a message carries so the other device knows there is something to fetch."""

    name: str
    mime: str
    size: int
    kind: AttachmentKind


class Attachment(AttachmentMeta):
    """The encrypted blob itself, fetched one message at a time to keep threads light."""

    message_id: str
    room_id: str
    iv: str
    data: str
    created_at: datetime


class MessageCreate(BaseModel):
    sender_id: str = Field(min_length=1, max_length=64)
    device_label: str = Field(default="Device", min_length=1, max_length=48)
    iv: str = Field(min_length=1, max_length=64)
    ciphertext: str = Field(min_length=1, max_length=MAX_CIPHERTEXT_LENGTH)
    attachment: AttachmentCreate | None = None


class Message(BaseModel):
    # uuid4 string, never Mongo ObjectId — ObjectId is not JSON-serializable.
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    sender_id: str
    device_label: str
    iv: str
    ciphertext: str
    # Metadata only: the blob lives in its own collection so listing never ships megabytes.
    attachment: AttachmentMeta | None = None
    created_at: datetime


class Presence(BaseModel):
    room_id: str
    online_device_ids: list[str]
    peer_online: bool


class ClearResult(BaseModel):
    deleted: int
    attachments_deleted: int
