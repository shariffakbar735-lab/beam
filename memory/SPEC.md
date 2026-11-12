# Beam — spec

Living spec. Update this in the same turn as any feature change.

## What it is

Beam relays text instantly between two of the user's own devices (phone + laptop),
like a private chat between them. No sign-up, no login, no Bluetooth — everything
goes through the backend over the internet, and the payload is encrypted in the
browser before it leaves the device.

Public URL: `https://beam-text--2jg4s02a.preview.emergentagent.com`

## Data model (Mongo, DB `app`)

`rooms`
| field | type | notes |
|---|---|---|
| `id` | str | 20 chars from `ABCDEFGHJKMNPQRSTVWXYZ23456789` (~99 bits), generated server-side |
| `created_at` | datetime | aware UTC |

`messages`
| field | type | notes |
|---|---|---|
| `id` | str | `uuid4` (never `ObjectId`) |
| `room_id` | str | |
| `sender_id` | str | random per-device id from `localStorage` (not the device label) |
| `device_label` | str | plaintext, max 48 — it is displayed to the other side anyway |
| `iv` | str | base64url AES-GCM nonce (12 bytes) |
| `ciphertext` | str | base64url AES-GCM ciphertext; **the server cannot read it** |
| `created_at` | datetime | aware UTC; TTL index `expireAfterSeconds=86400` |

Indexes (`backend/lib/db.py` → `ensure_indexes()`):
- `rooms.id` unique, `rooms.created_at` desc
- `messages.id` unique, `(room_id, created_at)` asc, `messages.created_at` TTL 24 h

Hard deletes exist in exactly two narrowly-scoped places: `Clear all` (explicit user
action, filtered by one `room_id`) and the 24-hour retention sweep on read.

## Endpoints (all on `api_router`, prefix `/api`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/` | `{app, status}` health probe |
| POST | `/api/rooms` | 201 `Room` |
| GET | `/api/rooms/{id}` | 404 if unknown |
| GET | `/api/rooms/{id}/messages` | oldest → newest, sweeps >24 h old first |
| POST | `/api/rooms/{id}/messages` | 201 `Message`, also broadcasts `{type:"message"}` |
| DELETE | `/api/rooms/{id}/messages` | `{deleted:n}`, broadcasts `{type:"cleared"}` |
| GET | `/api/rooms/{id}/presence?device_id=` | doubles as the polling heartbeat |
| WS | `/api/ws/{id}?device_id=` | close codes 4400 (no device_id), 4404 (unknown room) |

WS frames in: `{"type":"ping"}`. Frames out: `message`, `cleared`, `presence`, `pong`.

## Encryption

- Web Crypto **AES-GCM 256** (`frontend/src/lib/crypto.ts`). Random 12-byte IV per message.
- The key is generated on the device that creates the room and travels only in the URL
  **fragment**: `…/r/<ROOMID>#k=<base64url key>`. Fragments are never sent to a server.
- The receiving device reads the fragment on mount, stores it in `localStorage`
  (`beam.session.v1`), then strips the fragment via `history.replaceState`.
- Consequence: `localStorage` on each device holds the room key. That is what makes
  "reopen the app and reconnect" work. Anyone with the link can read the room.

## Frontend flows

- `/` (pairing desk, `pages/Home.tsx`): "Create a private room" → `POST /rooms` →
  `beginFreshSession()` mints the AES key → navigate to the room. If a session is
  already in `localStorage`, `/` immediately `<Navigate>`s to that room (auto-reconnect).
  Also accepts a pasted pairing link (`#k=` required).
- `/r/:roomId` (`pages/Room.tsx`):
  - Device label: auto-detected as `Phone` / `Laptop` (UA plus a coarse-primary-pointer
  check, so an emulated or unrecognised mobile browser still reads as `Phone`), editable
  from the header, persisted in the session.
- Desktop (≥768 px): 12-col split — pairing HUD (QR + link + room id) on the left,
    chat stream on the right.
  - Mobile: full-height stream, pairing HUD inside a dialog from the header menu.
  - No key for the room → "This device has no key" panel with a route back to its own room.
- Composer: Enter sends / Shift+Enter newline **on fine-pointer devices only** (touch
  keyboards keep Enter as newline). 10 000-character cap, count shown live.
- `Paste & Send` reads `navigator.clipboard.readText()` and sends immediately; on a
  blocked/empty clipboard it focuses the textarea and toasts.
- Per-message `Copy` with a "Copied" state; URLs inside messages render as links.
- `Auto-copy incoming text` (default off, persisted) copies only messages that arrive
  while the tab is watching — never the backlog — and fails silently.
- `Clear all` deletes the room's messages on the server and broadcasts `cleared`.
- `Unpair / new room` clears the session, `queryClient.clear()`s, and returns to `/`.

## Realtime

- WebSocket first. `lib/socket.ts` reconnects with 500 ms → 1 s → 2 s backoff, then
  declares `failed` and the messages query polls every 2 s; it keeps re-attempting the
  socket every 20 s and returns to live automatically when one opens.
- Status badge: `Connected` (live) / `Connecting` (first attempt) / `Reconnecting` (polling).
- Presence: in-memory hub (`backend/lib/realtime.py`), 20 s window, refreshed by WS pings
  (10 s) and by the presence poll (5 s). Single uvicorn worker, so in-memory is authoritative.

## PWA

`public/manifest.webmanifest` (standalone, dark theme, 192/512 + maskable icons),
`public/sw.js` (precaches only the static icon/manifest set; `/api/*`, the module graph
and HMR always go to the network), registered from `src/main.tsx`. Icons are generated by
a Pillow script (not committed) — `public/icon-*.png`, `apple-touch-icon.png`, favicons.

## Seed data / test setup

None needed — a room is created through the UI. To exercise two devices, capture the
shareable link from the room page and open it in a **separate browser context** (a second
page in the same context shares `localStorage`, so both pages would be the same device).

## Known deviations

- The 10 000-character limit is enforced in the browser; the server enforces only a
  20 000-character ciphertext ceiling (it cannot see plaintext length).
- Presence is per-process (single worker) — a multi-replica deployment would need shared state.
- WebSocket support through the preview ingress is not guaranteed; the 2 s polling
  fallback covers it, and the UI says "Reconnecting".
