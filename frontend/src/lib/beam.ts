// Beam session + wire types.
//
// Types here mirror the Pydantic models in backend/models/beam.py by hand — nothing
// infers across the HTTP boundary, so both sides change in the same edit.

import { generateRoomKey, randomBase64Url } from "@/lib/crypto";

/** Mirrors models.beam.MAX_PLAINTEXT_LENGTH — the composer enforces this before encrypting. */
export const MESSAGE_MAX_LENGTH = 10_000;

export interface BeamRoom {
  id: string;
  created_at: string;
}

/** Mirrors models.beam.Message: the body is opaque ciphertext, never plaintext. */
export interface BeamMessage {
  id: string;
  room_id: string;
  sender_id: string;
  device_label: string;
  iv: string;
  ciphertext: string;
  created_at: string;
}

export interface BeamPresence {
  room_id: string;
  online_device_ids: string[];
  peer_online: boolean;
}

export interface BeamClearResult {
  deleted: number;
}

export interface BeamSession {
  roomId: string;
  /** AES-GCM key, base64url. Lives in localStorage + the link fragment, never on the server. */
  key: string;
  deviceId: string;
  deviceLabel: string;
}

const SESSION_STORAGE_KEY = "beam.session.v1";
const AUTO_COPY_STORAGE_KEY = "beam.autocopy.v1";
const LABEL_MAX_LENGTH = 32;

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — the session simply won't persist */
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function newDeviceId(): string {
  return randomBase64Url(12);
}

/** Spec labels are "Phone" or "Laptop"; the user can rename theirs afterwards. */
export function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  if (/iPhone|iPod|iPad|Android/i.test(ua)) return "Phone";
  if (/Macintosh/.test(ua) && touchPoints > 1) return "Phone"; // iPadOS reports as Mac
  // UA sniffing alone misses emulated/undetectable mobile browsers: a touch-first
  // primary pointer is the device actually in the user's hand.
  if (touchPoints > 0 && window.matchMedia("(pointer: coarse)").matches) return "Phone";
  return "Laptop";
}

export function normaliseLabel(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, " ");
  return (trimmed || "Device").slice(0, LABEL_MAX_LENGTH);
}

export function loadSession(): BeamSession | null {
  const raw = readJson<Partial<BeamSession>>(SESSION_STORAGE_KEY);
  if (!raw || typeof raw.roomId !== "string" || !raw.roomId) return null;
  if (typeof raw.key !== "string" || !raw.key) return null;
  return {
    roomId: raw.roomId,
    key: raw.key,
    deviceId: typeof raw.deviceId === "string" && raw.deviceId ? raw.deviceId : newDeviceId(),
    deviceLabel:
      typeof raw.deviceLabel === "string" && raw.deviceLabel.trim()
        ? normaliseLabel(raw.deviceLabel)
        : detectDeviceLabel(),
  };
}

export function saveSession(session: BeamSession): void {
  writeJson(SESSION_STORAGE_KEY, session);
}

export function clearSession(): void {
  removeKey(SESSION_STORAGE_KEY);
}

export function loadAutoCopy(): boolean {
  return readJson<boolean>(AUTO_COPY_STORAGE_KEY) === true;
}

export function saveAutoCopy(enabled: boolean): void {
  writeJson(AUTO_COPY_STORAGE_KEY, enabled);
}

const KEY_PATTERN = /^[A-Za-z0-9\-_]{16,128}$/;

/** The key rides the fragment so the server never sees it. */
export function readKeyFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const key = params.get("k") ?? params.get("key");
  return key && KEY_PATTERN.test(key) ? key : null;
}

export function roomLink(roomId: string, key: string): string {
  return `${window.location.origin}/r/${roomId}#k=${key}`;
}

export function roomPath(roomId: string): string {
  return `/r/${roomId}`;
}

/** Drop the fragment from the address bar now that the key is in localStorage. */
export function stripRoomHash(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

export interface BootstrapResult {
  session: BeamSession | null;
  /** "link" = the fragment carried a key, "stored" = we remembered this room already. */
  source: "link" | "stored" | "missing";
  /** A different room is remembered on this device — offer a way back to it. */
  otherRoomId: string | null;
}

/**
 * Resolve this device's session for `roomId`: a scanned link wins, then localStorage.
 * Idempotent — safe to call twice under StrictMode.
 */
export function bootstrapRoomSession(roomId: string): BootstrapResult {
  const stored = loadSession();
  const linkKey = readKeyFromHash(window.location.hash);

  if (linkKey) {
    const session: BeamSession = {
      roomId,
      key: linkKey,
      deviceId: stored?.deviceId ?? newDeviceId(),
      deviceLabel: stored?.deviceLabel ?? detectDeviceLabel(),
    };
    saveSession(session);
    stripRoomHash();
    return { session, source: "link", otherRoomId: stored && stored.roomId !== roomId ? stored.roomId : null };
  }

  if (stored && stored.roomId === roomId) {
    return { session: stored, source: "stored", otherRoomId: null };
  }

  return { session: null, source: "missing", otherRoomId: stored?.roomId ?? null };
}

export interface FreshSession {
  session: BeamSession;
  link: string;
}

/** Start a brand new room: fresh random id from the server, fresh AES key on this device. */
export function beginFreshSession(roomId: string, previousLabel: string | null): FreshSession {
  const session: BeamSession = {
    roomId,
    key: generateRoomKey(),
    deviceId: newDeviceId(),
    deviceLabel: previousLabel ? normaliseLabel(previousLabel) : detectDeviceLabel(),
  };
  saveSession(session);
  return { session, link: roomLink(roomId, session.key) };
}

export interface PairingInput {
  roomId: string;
  key: string | null;
}

/** Accepts a full pairing URL, a path, or a bare room id typed by hand. */
export function parsePairingInput(value: string): PairingInput | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let roomId = "";
  let key: string | null = null;

  try {
    const url = new URL(trimmed, window.location.origin);
    const match = /\/r\/([A-Za-z0-9]+)/.exec(url.pathname);
    if (match) {
      roomId = match[1].toUpperCase();
      key = readKeyFromHash(url.hash);
    }
  } catch {
    /* not URL-shaped — fall through to the bare-room-id case */
  }

  if (!roomId) {
    const bare = /^([A-Za-z0-9]{8,32})(?:#k=([A-Za-z0-9\-_]+))?$/.exec(trimmed);
    if (bare) {
      roomId = bare[1].toUpperCase();
      key = bare[2] ?? null;
    }
  }

  return roomId ? { roomId, key } : null;
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function messageOrderKey(message: BeamMessage): string {
  return `${message.created_at}\u0000${message.id}`;
}

export function mergeMessages(base: BeamMessage[], extra: BeamMessage[]): BeamMessage[] {
  const byId = new Map<string, BeamMessage>();
  for (const message of [...base, ...extra]) {
    if (!byId.has(message.id)) byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => (messageOrderKey(a) < messageOrderKey(b) ? -1 : 1));
}

/** Fire-and-forget clipboard write that stays quiet when the browser blocks it. */
export function copySilently(text: string): void {
  const clipboard = navigator.clipboard;
  if (!clipboard?.writeText) return;
  clipboard.writeText(text).catch(() => undefined);
}

export async function copyOrThrow(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
  await navigator.clipboard.writeText(text);
}
