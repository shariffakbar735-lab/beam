// AES-GCM, performed entirely in the browser with the Web Crypto API.
//
// The room key is generated on the first device and travels only inside the URL
// fragment (#k=...) — browsers never send a fragment to a server, so the backend
// stores and relays ciphertext it has no way to read.

const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit GCM nonce

export interface SealedPayload {
  iv: string;
  ciphertext: string;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Return types are deliberately inferred: Web Crypto's BufferSource will not accept a
// Uint8Array<ArrayBufferLike>, whereas `new Uint8Array(length)` is ArrayBuffer-backed.
export function fromBase64Url(value: string) {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A fresh ArrayBuffer-backed copy — the only shape `crypto.subtle` accepts. */
function bufferSource(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function generateRoomKey(): string {
  return randomBase64Url(KEY_BYTES);
}

export function isCryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle?.encrypt === "function";
}

async function importKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bufferSource(fromBase64Url(key)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(plaintext: string, key: string): Promise<SealedPayload> {
  return encryptBytes(new TextEncoder().encode(plaintext), key);
}

export async function decryptText(payload: SealedPayload, key: string): Promise<string> {
  return new TextDecoder().decode(await decryptBytes(payload, key));
}

/** Same envelope, but for file bytes — used by the image/file relay. */
export async function encryptBytes(data: Uint8Array, key: string): Promise<SealedPayload> {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const cryptoKey = await importKey(key);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    bufferSource(data),
  );
  return { iv: toBase64Url(iv), ciphertext: toBase64Url(new Uint8Array(sealed)) };
}

export async function decryptBytes(payload: SealedPayload, key: string) {
  const cryptoKey = await importKey(key);
  const opened = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bufferSource(fromBase64Url(payload.iv)) },
    cryptoKey,
    bufferSource(fromBase64Url(payload.ciphertext)),
  );
  return new Uint8Array(opened);
}
