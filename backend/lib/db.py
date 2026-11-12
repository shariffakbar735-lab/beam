"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "rooms": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
    ],
    "messages": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        # read pattern: one room, oldest first
        IndexModel([("room_id", ASCENDING), ("created_at", ASCENDING)], name="room_created"),
        # 24 h self-destruct (MESSAGE_TTL_SECONDS in models/beam.py)
        IndexModel([("created_at", ASCENDING)], name="created_ttl", expireAfterSeconds=86400),
    ],
    "attachments": [
        IndexModel([("message_id", ASCENDING)], name="message_id", unique=True),
        IndexModel([("room_id", ASCENDING), ("created_at", ASCENDING)], name="room_created"),
        IndexModel([("created_at", ASCENDING)], name="created_ttl", expireAfterSeconds=86400),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
