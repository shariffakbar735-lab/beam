// WebSocket transport for one room, with automatic reconnect.
//
// Status contract for the caller:
//   "connecting" → first attempt in flight (or a quick retry) — keep the UI on "Connecting…"
//   "open"       → live socket, stop polling
//   "failed"     → rapid retries exhausted; the caller switches to 2 s polling. We keep
//                  quietly re-attempting every SLOW_RETRY_MS so a socket can still take over.

export type SocketStatus = "connecting" | "open" | "failed";

export interface RoomSocket {
  send: (payload: unknown) => void;
  close: () => void;
}

export interface RoomSocketOptions {
  roomId: string;
  deviceId: string;
  onEvent: (event: unknown) => void;
  onStatus: (status: SocketStatus) => void;
  heartbeatMs?: number;
}

const RAPID_RETRY_DELAYS_MS = [500, 1000, 2000];
const SLOW_RETRY_MS = 20_000;
const HEARTBEAT_MS = 10_000;

// Terminal close codes from routers/realtime.py: never hammer a rejected handshake,
// but do keep re-checking slowly in case the room appears later.
const FATAL_CODES = new Set([4400, 4404]);

export function openRoomSocket({
  roomId,
  deviceId,
  onEvent,
  onStatus,
  heartbeatMs = HEARTBEAT_MS,
}: RoomSocketOptions): RoomSocket {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${scheme}//${window.location.host}/api/ws/${encodeURIComponent(roomId)}?device_id=${encodeURIComponent(deviceId)}`;

  let socket: WebSocket | null = null;
  let heartbeat: number | undefined;
  let timer: number | undefined;
  let attempt = 0;
  let disposed = false;

  const clearTimers = () => {
    if (heartbeat !== undefined) {
      window.clearInterval(heartbeat);
      heartbeat = undefined;
    }
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    if (attempt < RAPID_RETRY_DELAYS_MS.length) {
      const delay = RAPID_RETRY_DELAYS_MS[attempt];
      attempt += 1;
      timer = window.setTimeout(connect, delay);
      return;
    }
    onStatus("failed");
    attempt = 0;
    timer = window.setTimeout(connect, SLOW_RETRY_MS);
  };

  const connect = () => {
    if (disposed) return;
    onStatus("connecting");

    let next: WebSocket;
    try {
      next = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    socket = next;

    next.onopen = () => {
      attempt = 0;
      onStatus("open");
      heartbeat = window.setInterval(() => {
        if (next.readyState === WebSocket.OPEN) next.send(JSON.stringify({ type: "ping" }));
      }, heartbeatMs);
    };

    next.onmessage = (event) => {
      try {
        onEvent(JSON.parse(String(event.data)));
      } catch {
        /* malformed frame — ignore */
      }
    };

    next.onclose = (event) => {
      if (heartbeat !== undefined) {
        window.clearInterval(heartbeat);
        heartbeat = undefined;
      }
      if (socket === next) socket = null;
      if (FATAL_CODES.has(event.code)) {
        onStatus("failed");
        timer = window.setTimeout(connect, SLOW_RETRY_MS);
        return;
      }
      scheduleReconnect();
    };

    next.onerror = () => {
      /* onclose always follows; reconnect logic lives there */
    };
  };

  connect();

  return {
    send(payload: unknown) {
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    },
    close() {
      disposed = true;
      clearTimers();
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        try {
          socket.close();
        } catch {
          /* already gone */
        }
        socket = null;
      }
    },
  };
}
